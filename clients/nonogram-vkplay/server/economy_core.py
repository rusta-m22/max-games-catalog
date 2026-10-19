"""Nonograms economy and period rankings. Python 3.11+, standard library only."""
import base64,hashlib,hmac,json,logging,os,re,secrets,sqlite3,threading,time
from datetime import datetime,timedelta,timezone
from http.server import BaseHTTPRequestHandler,ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlparse,parse_qs
ROOT=Path(__file__).resolve().parent
CAT=json.loads((ROOT/'catalog.json').read_text());DATA=json.loads((ROOT/'content.json').read_text())
LEVELS={p['id']:p for p in DATA['levels']};ITEMS={p['id']:p for p in CAT['items']};PRODUCTS={p['id']:p['coins'] for p in CAT['products']}
CAMPAIGN=[p for p in DATA['levels'] if p['type'] not in ('mega','bonus')]
QUESTS=['three','colour','perfect','pure','ranked']
class Error(Exception):
 def __init__(self,code,status=400):self.code=code;self.status=status

def integer(v,default=0,maximum=10**9):
 if isinstance(v,bool) or not isinstance(v,(int,float)) or int(v)!=v or not 0<=v<=maximum:return default
 return int(v)
def dump(v):return json.dumps(v,ensure_ascii=False,separators=(',',':'))
def day_at(ms):return datetime.fromtimestamp(ms/1000,timezone.utc).strftime('%Y-%m-%d')
def week_at(day):
 d=datetime.strptime(day,'%Y-%m-%d');return (d-timedelta(days=d.weekday())).strftime('%Y-%m-%d')
def period_end(kind,period):return int((datetime.strptime(period,'%Y-%m-%d').replace(tzinfo=timezone.utc)+timedelta(days=1 if kind=='daily' else 7)).timestamp()*1000)
def fnv(s):
 h=2166136261
 for c in s:h=((h^ord(c))*16777619)&0xffffffff
 return h
def day_puzzle(day):
 pool=[p for p in CAMPAIGN if 10<=p['n']<=20 and p['index']<24 and len(p['givens'])<3];return pool[fnv(day)%len(pool)]
def ranked_set(day):
 out=[]
 for slot,(lo,hi) in enumerate([(5,10),(15,20),(25,30)]):
  pool=[p for p in CAMPAIGN if lo<=p['n']<=hi and p['type']=='normal'];out.append(pool[fnv(day+':'+str(slot))%len(pool)])
 return out


class EconomyStore:
 def __init__(self,path,secret,game_id,clock=None):
  if not secret or not game_id:raise RuntimeError('VKPLAY_SECRET and VKPLAY_APP_ID are required')
  self.secret=secret;self.game_id=str(game_id);self.clock=clock or (lambda:int(time.time()*1000));self.lock=threading.RLock()
  self.db=sqlite3.connect(path,check_same_thread=False,isolation_level=None);self.db.row_factory=sqlite3.Row
  self.db.executescript('''PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,coins INTEGER NOT NULL CHECK(coins>=0),data TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 1,name TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT '');
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,uid TEXT NOT NULL,expires INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS operations(uid TEXT NOT NULL,id TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(uid,id));
  CREATE TABLE IF NOT EXISTS ledger(uid TEXT NOT NULL,id TEXT NOT NULL,amount INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(uid,id));
  CREATE TABLE IF NOT EXISTS solves(uid TEXT NOT NULL,id TEXT NOT NULL,day TEXT NOT NULL,world INTEGER NOT NULL,n INTEGER NOT NULL,type TEXT NOT NULL,color INTEGER NOT NULL,errors INTEGER NOT NULL,hints INTEGER NOT NULL,stars INTEGER NOT NULL,PRIMARY KEY(uid,id));
  CREATE TABLE IF NOT EXISTS activity(uid TEXT NOT NULL,day TEXT NOT NULL,id TEXT NOT NULL,color INTEGER NOT NULL,errors INTEGER NOT NULL,hints INTEGER NOT NULL,PRIMARY KEY(uid,day,id));
  CREATE TABLE IF NOT EXISTS attempts(id TEXT PRIMARY KEY,uid TEXT NOT NULL,day TEXT NOT NULL,slot INTEGER NOT NULL,puzzle TEXT NOT NULL,started INTEGER NOT NULL,finished INTEGER NOT NULL DEFAULT 0);
  CREATE TABLE IF NOT EXISTS scores(uid TEXT NOT NULL,day TEXT NOT NULL,slot INTEGER NOT NULL,score INTEGER NOT NULL,updated INTEGER NOT NULL,PRIMARY KEY(uid,day,slot));
  CREATE TABLE IF NOT EXISTS periods(kind TEXT NOT NULL,id TEXT NOT NULL,entries TEXT NOT NULL,PRIMARY KEY(kind,id));
  CREATE TABLE IF NOT EXISTS prizes(uid TEXT NOT NULL,kind TEXT NOT NULL,period TEXT NOT NULL,rank INTEGER NOT NULL,coins INTEGER NOT NULL,claimed INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(uid,kind,period));
  CREATE INDEX IF NOT EXISTS scores_day ON scores(day);CREATE INDEX IF NOT EXISTS activity_day ON activity(uid,day);
  ''')
 def tx(self,fn):
  with self.lock:
   self.db.execute('BEGIN IMMEDIATE')
   try:r=fn();self.db.execute('COMMIT');return r
   except BaseException:self.db.execute('ROLLBACK');raise
 def user(self,uid):
  r=self.db.execute('SELECT * FROM users WHERE id=?',(uid,)).fetchone()
  if r is None:raise Error('AUTH_REQUIRED',401)
  return r,json.loads(r['data'])
 def write(self,uid,data):self.db.execute('UPDATE users SET data=?,revision=revision+1 WHERE id=?',(dump(data),uid))
 def credit(self,uid,key,amount):
  if self.db.execute('SELECT 1 FROM ledger WHERE uid=? AND id=?',(uid,key)).fetchone():return False
  changed=self.db.execute('UPDATE users SET coins=coins+?,revision=revision+1 WHERE id=? AND coins+?>=0',(amount,uid,amount)).rowcount
  if not changed:raise Error('NOT_ENOUGH_COINS',409)
  self.db.execute('INSERT INTO ledger VALUES(?,?,?,?)',(uid,key,amount,self.clock()));return True
 def snapshot(self,uid):
  r,d=self.user(uid);today=day_at(self.clock());return dict(coins=r['coins'],revision=r['revision'],owned=d['owned'],hintCredits=d['hintCredits'],claimed=d['claimed'],megaRewards=d['megaRewards'],lastDailyPrize=d.get('lastDailyPrize'),lastWeeklyPrize=d.get('lastWeeklyPrize'),daily=self.daily(uid,today),prizes=[dict(p) for p in self.db.execute('SELECT kind,period,rank,coins,claimed FROM prizes WHERE uid=? AND claimed=0 ORDER BY period DESC LIMIT 100',(uid,))],serverTime=self.clock())
 def authenticated(self,token):
  with self.lock:
   r=self.db.execute('SELECT uid FROM sessions WHERE token=? AND expires>?',(token,self.clock())).fetchone()
   if not r:raise Error('AUTH_REQUIRED',401)
   return r['uid']
 def daily(self,uid,day):
  rows=list(self.db.execute('SELECT * FROM activity WHERE uid=? AND day=?',(uid,day)));ranked=self.db.execute('SELECT COUNT(*) FROM scores WHERE uid=? AND day=?',(uid,day)).fetchone()[0]
  counts=[len(rows),sum(r['color'] for r in rows),sum(r['errors']==0 for r in rows),sum(r['hints']==0 for r in rows),ranked]
  return {'day':day,'tasks':[dict(id=k,count=min(counts[i],[3,1,1,1,3][i]),target=[3,1,1,1,3][i],coins=[60,40,40,40,80][i],claimed=bool(self.db.execute('SELECT 1 FROM ledger WHERE uid=? AND id=?',(uid,'quest:'+day+':'+k)).fetchone())) for i,k in enumerate(QUESTS)]}
 def reward_for(self,p,stars):return 80 if p['type']=='daily' else 80 if p['type']=='secret' else 120 if p['type']=='final' else 45 if p['type']=='mega' else 20+stars*5
 def is_open(self,uid,p,d):
  owned=d['owned'];done={r[0] for r in self.db.execute('SELECT id FROM solves WHERE uid=?',(uid,))}
  if p['type']=='bonus':return bool(owned.get(p['pack']))
  if p['type']=='mega':
   m=DATA['megas'][p['mega']];return owned.get('mega_'+str(m['id'])) or all(f'w{m["unlock"]+1}-{i}' in done for i in range(1,31)) and (m['id']!=4 or all(f'w{w+1}-{j}' in done for w in range(10) for j in [25,26,27]))
  w=p['world'];i=p['index'];pref=f'w{w+1}-';world=w==0 or f'w{w}-30' in done or owned.get('world_'+str(w))
  if owned.get(f'secret_{w}_{i-24}') and p['type']=='secret':return True
  if p['type']=='normal' and (owned.get('size_'+str(p['n'])) or owned.get(f'chapter_{w}_{i//6}') or owned.get('world_'+str(w))):return True
  if not world:return False
  if i<24:return i==0 or pref+str(i) in done
  count=sum(pref+str(j) in done for j in range(1,25))
  return count>=6+(i-24)*6 if p['type']=='secret' else count==24
 def solve(self,uid,payload,d):
  pid=payload.get('id');p=LEVELS.get(pid)
  if isinstance(pid,str) and pid.startswith('daily-'):
   day=pid[6:]
   if day!=day_at(self.clock()):raise Error('PERIOD_ENDED',409)
   p=dict(day_puzzle(day),id=pid,type='daily')
  if not p:raise Error('UNKNOWN_PUZZLE')
  if p['type']!='daily' and not self.is_open(uid,p,d):raise Error('PUZZLE_LOCKED',403)
  cells=payload.get('cells','')
  if not isinstance(cells,str) or cells.replace('x','0')!=p['grid']:raise Error('WRONG_SOLUTION')
  errors=integer(payload.get('errors'));hints=integer(payload.get('hints'));stars=max(1,3-int(errors>0)-int(hints>0))
  if p['type']=='perfect' and errors:raise Error('CHALLENGE_FAILED')
  if p['type']=='pure' and hints:raise Error('CHALLENGE_FAILED')
  day=day_at(self.clock());old=self.db.execute('SELECT * FROM solves WHERE uid=? AND id=?',(uid,pid)).fetchone();reward=0
  if not old:
   self.db.execute('INSERT INTO solves VALUES(?,?,?,?,?,?,?,?,?,?)',(uid,pid,day,p['world'],p['n'],p['type'],int(p['color']),errors,hints,stars));reward=self.reward_for(p,stars);self.credit(uid,'solve:'+pid,reward)
  else:self.db.execute('UPDATE solves SET stars=MAX(stars,?),errors=MIN(errors,?),hints=MIN(hints,?) WHERE uid=? AND id=?',(stars,errors,hints,uid,pid))
  self.db.execute('INSERT OR IGNORE INTO activity VALUES(?,?,?,?,?,?)',(uid,day,pid,int(p['color']),errors,hints))
  if p['type']=='mega':
   m=DATA['megas'][p['mega']]
   if all(self.db.execute('SELECT 1 FROM solves WHERE uid=? AND id=?',(uid,id)).fetchone() for id in m['levels']) and not d['megaRewards'].get(str(m['id'])):
    bonus=500+m['id']*150;self.credit(uid,'mega:'+str(m['id']),bonus);d['megaRewards'][str(m['id'])]=True;reward+=bonus
  return {'reward':reward}
 def achievement(self,uid,id,d):
  rows=list(self.db.execute("SELECT * FROM solves WHERE uid=? AND type NOT IN ('mega','bonus')",(uid,)));a=[r for r in rows if not r['id'].startswith('daily-')]
  world=max([sum(r['world']==w for r in a) for w in range(10)],default=0)
  rules={'first':(len(a),1,30),'ten':(len(a),10,70),'fifty':(len(a),50,150),'hundred':(len(a),100,250),'all':(len(a),300,1000),'perfect':(sum(r['stars']==3 for r in a),10,100),'secrets':(sum(r['type']=='secret' for r in a),3,150),'colour':(sum(r['color'] for r in a),20,150),'world':(world,30,200),'big':(sum(r['n']==50 for r in a),1,300),'mega':(len(d['megaRewards']),1,300),'days':(sum(r['id'].startswith('daily-') for r in rows),7,200)}
  if id not in rules or rules[id][0]<rules[id][1]:raise Error('NOT_COMPLETED')
  if not d['claimed'].get(id):self.credit(uid,'achievement:'+id,rules[id][2]);d['claimed'][id]=True
 def action(self,uid,operation,kind,payload):
  if not isinstance(operation,str) or not re.fullmatch(r'[A-Za-z0-9_.:-]{8,180}',operation):raise Error('BAD_OPERATION_ID')
  def run():
   prior=self.db.execute('SELECT result FROM operations WHERE uid=? AND id=?',(uid,operation)).fetchone()
   if prior:return {**json.loads(prior['result']),'wallet':self.snapshot(uid),'duplicate':True}
   r,d=self.user(uid);result={}
   if kind=='shop':
    item=ITEMS.get(payload.get('id'))
    if not item:raise Error('UNKNOWN_ITEM')
    if item['kind']=='hint' or not d['owned'].get(item['id']):
     self.credit(uid,'spend:'+operation,-item['cost'])
     if item['kind']=='hint':d['hintCredits'][item['hint']]+=1
     else:d['owned'][item['id']]=True
   elif kind=='hint_use':
    h=payload.get('hint');pid=payload.get('puzzle');p=LEVELS.get(pid)
    if h not in d['hintCredits'] or p and p['type']=='pure' or str(pid).startswith('rank-'):raise Error('HINT_UNAVAILABLE')
    if d['hintCredits'][h]>0:d['hintCredits'][h]-=1
    else:self.credit(uid,'spend:'+operation,-ITEMS['hint_'+h]['cost'])
   elif kind=='solve':result=self.solve(uid,payload,d)
   elif kind=='achievement':self.achievement(uid,payload.get('id'),d)
   elif kind=='quest':
    day=payload.get('day');qid=payload.get('id')
    if day!=day_at(self.clock()):raise Error('PERIOD_ENDED',409)
    task=next((t for t in self.daily(uid,day)['tasks'] if t['id']==qid),None)
    if not task or task['count']<task['target']:raise Error('NOT_COMPLETED')
    self.credit(uid,'quest:'+day+':'+qid,task['coins'])
    if qid=='ranked':d['owned']['effect_stars']=True
   elif kind=='prize':
    self.finalize();kind2=payload.get('kind');period=payload.get('period');prize=self.db.execute('SELECT * FROM prizes WHERE uid=? AND kind=? AND period=?',(uid,kind2,period)).fetchone()
    if not prize:raise Error('PRIZE_NOT_FOUND',404)
    if not prize['claimed']:self.credit(uid,'prize:'+kind2+':'+period,prize['coins']);self.db.execute('UPDATE prizes SET claimed=1 WHERE uid=? AND kind=? AND period=?',(uid,kind2,period))
    d['lastDailyPrize' if kind2=='daily' else 'lastWeeklyPrize']=max(period,d.get('lastDailyPrize' if kind2=='daily' else 'lastWeeklyPrize') or '')
   else:raise Error('UNKNOWN_ACTION')
   self.write(uid,d);self.db.execute('INSERT INTO operations VALUES(?,?,?)',(uid,operation,dump(result)));return {**result,'wallet':self.snapshot(uid)}
  return self.tx(run)
 def begin(self,uid,slot):
  if slot not in (0,1,2):raise Error('UNKNOWN_SLOT')
  def run():
   day=day_at(self.clock());p=ranked_set(day)[slot];ticket=secrets.token_urlsafe(24)
   # One active ranked attempt prevents starting a batch of timers in parallel.
   self.db.execute('UPDATE attempts SET finished=2 WHERE uid=? AND finished=0',(uid,));self.db.execute('INSERT INTO attempts(id,uid,day,slot,puzzle,started) VALUES(?,?,?,?,?,?)',(ticket,uid,day,slot,p['id'],self.clock()))
   return {'ticket':ticket,'day':day,'endsAt':period_end('daily',day),'puzzle':dict(p,id='rank-'+day+'-'+str(slot),type='ranked',sourceId=p['id'],ticket=ticket)}
  return self.tx(run)
 def finish(self,uid,ticket,cells,errors,hints):
  def run():
   a=self.db.execute('SELECT * FROM attempts WHERE id=? AND uid=?',(ticket,uid)).fetchone()
   if not a:raise Error('ATTEMPT_NOT_FOUND',404)
   if a['finished']==2:raise Error('ATTEMPT_CANCELED',409)
   if a['finished']:
    row=self.db.execute('SELECT score FROM scores WHERE uid=? AND day=? AND slot=?',(uid,a['day'],a['slot'])).fetchone();return {'duplicate':True,'points':row['score'] if row else 0,'wallet':self.snapshot(uid)}
   if a['day']!=day_at(self.clock()):raise Error('PERIOD_ENDED',409)
   p=LEVELS[a['puzzle']]
   if not isinstance(cells,str) or cells.replace('x','0')!=p['grid']:raise Error('WRONG_SOLUTION')
   if integer(hints)>0:raise Error('RANKED_HINTS_FORBIDDEN')
   elapsed=max(1,self.clock()-a['started']);n=p['n'];base=n*n;bonus=max(0,round(100*(1-elapsed/(n*n*4000))));points=base+100+bonus+(100 if integer(errors)==0 else 0)
   self.db.execute('UPDATE attempts SET finished=1 WHERE id=?',(ticket,));old=self.db.execute('SELECT score FROM scores WHERE uid=? AND day=? AND slot=?',(uid,a['day'],a['slot'])).fetchone()
   if not old or points>old['score']:self.db.execute('INSERT INTO scores VALUES(?,?,?,?,?) ON CONFLICT(uid,day,slot) DO UPDATE SET score=excluded.score,updated=excluded.updated',(uid,a['day'],a['slot'],points,self.clock()))
   self.db.execute('INSERT OR IGNORE INTO activity VALUES(?,?,?,?,?,?)',(uid,a['day'],'rank-'+str(a['slot']),int(p['color']),integer(errors),0))
   return {'points':points,'wallet':self.snapshot(uid)}
  return self.tx(run)
 def entries(self,kind,period):
  end=day_at(period_end(kind,period));rows=self.db.execute('''SELECT uid,day,SUM(score) AS score,COUNT(*) AS completed,MAX(updated) AS updated FROM scores WHERE day>=? AND day<? GROUP BY uid,day''',(period,end));totals={}
  for r in rows:
   p=totals.setdefault(r['uid'],dict(userId=r['uid'],score=0,updated=0));p['score']+=r['score']+(100 if r['completed']==3 else 0);p['updated']=max(p['updated'],r['updated'])
  result=sorted(totals.values(),key=lambda r:(-r['score'],r['updated'],r['userId']))
  for rank,p in enumerate(result,1):
   u=self.db.execute('SELECT name,avatar FROM users WHERE id=?',(p['userId'],)).fetchone();p.update(rank=rank,name=u['name'],avatar=u['avatar']);p.pop('updated')
  return result
 def finalize(self):
  days=[r[0] for r in self.db.execute('SELECT DISTINCT day FROM scores')]
  for kind,periods in [('daily',set(days)),('weekly',{week_at(d) for d in days})]:
   for period in periods:
    if period_end(kind,period)>self.clock() or self.db.execute('SELECT 1 FROM periods WHERE kind=? AND id=?',(kind,period)).fetchone():continue
    rows=self.entries(kind,period);self.db.execute('INSERT INTO periods VALUES(?,?,?)',(kind,period,dump(rows)))
    schedule=CAT['dailyRewards' if kind=='daily' else 'weeklyRewards']
    for row in rows:
     reward=next((value for maxrank,value in schedule if row['rank']<=maxrank),0)
     if reward:self.db.execute('INSERT OR IGNORE INTO prizes(uid,kind,period,rank,coins) VALUES(?,?,?,?,?)',(row['userId'],kind,period,row['rank'],reward))
 def board(self,uid,kind):
  if kind not in ('daily','weekly'):raise Error('BAD_PERIOD')
  def run():
   self.finalize();today=day_at(self.clock());period=today if kind=='daily' else week_at(today);rows=self.entries(kind,period)
   own=next((r for r in rows if r['userId']==uid),None);lifetime=self.db.execute('SELECT COALESCE(SUM(total),0) FROM (SELECT SUM(score)+CASE WHEN COUNT(*)=3 THEN 100 ELSE 0 END AS total FROM scores WHERE uid=? GROUP BY day)',(uid,)).fetchone()[0];puzzles=[dict(id=p['id'],n=p['n'],color=p['color'],slot=i) for i,p in enumerate(ranked_set(today))]
   return dict(kind=kind,period=period,endsAt=period_end(kind,period),entries=rows[:20],own=own,lifetimeScore=lifetime,puzzles=puzzles,wallet=self.snapshot(uid))
  return self.tx(run)
 def wallet(self,uid):return self.tx(lambda:(self.finalize(),self.snapshot(uid))[1])
