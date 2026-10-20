"""Nonogram VK Play backend. Python 3.11+, standard library; dedicated DB."""
import hashlib, ipaddress, json, logging, os, re, secrets, signal, sqlite3, threading, time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from economy_core import EconomyStore, Error, CAT, dump
from vkplay import VKPlay, BillingRejected, valid_signature, ipv4
from settings import load_settings, ConfigurationError
PRODUCTS={p['id']:p for p in CAT['products']}
VERSION='3.2.1-vkplay-server'

class Store(EconomyStore):
 def __init__(self,path,api,billing_enabled=False,clock=None,products=None):
  super().__init__(path,api.secret,api.app_id,clock)
  self.api=api;self.billing_enabled=billing_enabled;self.products=products or PRODUCTS
  self.db.executescript('''
  CREATE TABLE IF NOT EXISTS vk_auth_attempts(otp_hash TEXT PRIMARY KEY,created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS vk_orders(id TEXT PRIMARY KEY,uid TEXT NOT NULL,product TEXT NOT NULL,coins INTEGER NOT NULL,item_def_id TEXT NOT NULL,request_id TEXT NOT NULL,status TEXT NOT NULL,url TEXT,created INTEGER NOT NULL,tid TEXT UNIQUE,UNIQUE(uid,request_id));
  CREATE TABLE IF NOT EXISTS vk_transactions(tid TEXT PRIMARY KEY,order_id TEXT NOT NULL UNIQUE,uid TEXT NOT NULL,coins INTEGER NOT NULL,receipt_hash TEXT NOT NULL,created INTEGER NOT NULL);
  CREATE TABLE IF NOT EXISTS vk_progress(uid TEXT PRIMARY KEY,data TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS vk_once(uid TEXT NOT NULL,product TEXT NOT NULL,PRIMARY KEY(uid,product));
  ''')
 def auth_vk(self,uid,otp,ip):
  if not isinstance(uid,str) or not re.fullmatch(r'[0-9]{1,24}',uid):raise Error('INVALID_UID')
  if not isinstance(otp,str) or not 8<=len(otp)<=4096:raise Error('INVALID_OTP')
  ipv4(ip)
  key=hashlib.sha256((uid+'\0'+otp).encode()).hexdigest()
  # Persist BEFORE GAS. An ambiguous network response must never retry the OTP.
  try:self.tx(lambda:self.db.execute('INSERT INTO vk_auth_attempts VALUES(?,?)',(key,self.clock())))
  except sqlite3.IntegrityError:raise Error('RELAUNCH_GAME_CENTER',401)
  self.api.gas(uid,otp,ip)
  def run():
   initial={'owned':{},'hintCredits':{'cell':3,'empty':0,'fix':0,'row':0,'column':0},'claimed':{},'megaRewards':{}}
   # Client balances/entitlements and legacy platform accounts are NEVER imported.
   self.db.execute('INSERT OR IGNORE INTO users(id,coins,data) VALUES(?,?,?)',(uid,120,dump(initial)))
   token=secrets.token_urlsafe(32)
   self.db.execute('DELETE FROM sessions WHERE expires<?',(self.clock(),))
   self.db.execute('INSERT INTO sessions VALUES(?,?,?)',(hashlib.sha256(token.encode()).hexdigest(),uid,self.clock()+12*3600000))
   return {'token':token,'userId':uid,'wallet':self.snapshot(uid),'progress':self.progress(uid)}
  return self.tx(run)
 def authenticated(self,token):
  if not isinstance(token,str) or len(token)>256:raise Error('AUTH_REQUIRED',401)
  return super().authenticated(hashlib.sha256(token.encode()).hexdigest())
 def catalog(self,uid):
  with self.lock:
   return {'products':[{'id':p['id'],'coins':p['coins'],'name':p['name'],'available':self.billing_enabled and not (p.get('once') and self.db.execute('SELECT 1 FROM vk_once WHERE uid=? AND product=?',(uid,p['id'])).fetchone())} for p in self.products.values()]}
 def order(self,uid,product_id,request_id,ip):
  if not self.billing_enabled:raise Error('BILLING_NOT_CONFIGURED',503)
  if not isinstance(request_id,str) or not re.fullmatch(r'[A-Za-z0-9_-]{8,100}',request_id):raise Error('INVALID_REQUEST_ID')
  product=self.products.get(product_id) if isinstance(product_id,str) else None
  if not product:raise Error('UNKNOWN_PRODUCT')
  ipv4(ip)
  def create():
   old=self.db.execute('SELECT * FROM vk_orders WHERE uid=? AND request_id=?',(uid,request_id)).fetchone()
   if old:
    if old['product']!=product_id:raise Error('REQUEST_ID_CONFLICT',409)
    return dict(old),False
   if product.get('once'):
    if self.db.execute('SELECT 1 FROM vk_once WHERE uid=? AND product=?',(uid,product_id)).fetchone():raise Error('ALREADY_OWNED',409)
    old=self.db.execute("SELECT * FROM vk_orders WHERE uid=? AND product=? AND status IN ('creating','pending','unknown')",(uid,product_id)).fetchone()
    if old:return dict(old),False
   oid=secrets.token_urlsafe(24)
   self.db.execute('INSERT INTO vk_orders(id,uid,product,coins,item_def_id,request_id,status,created) VALUES(?,?,?,?,?,?,?,?)',(oid,uid,product_id,product['coins'],product['itemDefId'],request_id,'creating',self.clock()))
   return dict(self.db.execute('SELECT * FROM vk_orders WHERE id=?',(oid,)).fetchone()),True
  order,new=self.tx(create)
  if new:
   try:
    url=self.api.billing(uid,ip,product,order['id'])
    self.tx(lambda:self.db.execute("UPDATE vk_orders SET url=?,status=CASE WHEN status='paid' THEN 'paid' ELSE 'pending' END WHERE id=?",(url,order['id'])))
   except BillingRejected:
    self.tx(lambda:self.db.execute("UPDATE vk_orders SET status='failed' WHERE id=? AND status='creating'",(order['id'],)))
    raise
   except Exception:
    self.tx(lambda:self.db.execute("UPDATE vk_orders SET status='unknown' WHERE id=? AND status='creating'",(order['id'],)))
    raise
  with self.lock:
   row=self.db.execute('SELECT * FROM vk_orders WHERE id=?',(order['id'],)).fetchone()
   if row['status']=='paid':return {'orderId':row['id'],'status':'paid'}
   if row['status']=='failed':raise BillingRejected()
   if not row['url']:raise Error('ORDER_STATUS_UNKNOWN',409)
   return {'orderId':row['id'],'status':row['status'],'paymentUrl':row['url']}
 def callback(self,params):
  if set(params)!={'uid','sum','tid','merchant_param','sign'}:raise Error('INVALID_CALLBACK')
  if not valid_signature(params,self.secret):raise Error('INVALID_SIGNATURE',403)
  uid,tid,raw=params['uid'],params['tid'],params['merchant_param']
  if not re.fullmatch(r'[A-Za-z0-9_-]{1,256}',tid):raise Error('INVALID_TRANSACTION_ID')
  try:
   m=json.loads(raw)
   if not isinstance(m,dict):raise ValueError()
   oid=m['additional_param'];product=m['item_id']
   if str(m['uid'])!=uid or not isinstance(oid,str) or not isinstance(product,str):raise ValueError()
  except (ValueError,KeyError,TypeError):raise Error('INVALID_MERCHANT')
  def run():
   order=self.db.execute('SELECT * FROM vk_orders WHERE id=?',(oid,)).fetchone()
   if not order:raise Error('UNKNOWN_ORDER',404)
   if order['uid']!=uid or order['product']!=product:raise Error('ORDER_OWNER_MISMATCH',403)
   prior=self.db.execute('SELECT * FROM vk_transactions WHERE tid=?',(tid,)).fetchone()
   if prior:
    if prior['uid']!=uid or prior['order_id']!=oid:raise Error('TRANSACTION_CONFLICT',409)
    return {'status':'ok'}
   if order['status']=='paid':raise Error('ORDER_ALREADY_PAID',409)
   # sum is informational, and can change on currency conversion. Grant the saved order.
   if self.products[product].get('once'):
    try:self.db.execute('INSERT INTO vk_once VALUES(?,?)',(uid,product))
    except sqlite3.IntegrityError:raise Error('ALREADY_OWNED',409)
   self.db.execute('INSERT INTO vk_transactions VALUES(?,?,?,?,?,?)',(tid,oid,uid,order['coins'],hashlib.sha256(raw.encode()).hexdigest(),self.clock()))
   self.credit(uid,'vkplay:'+tid,order['coins'])
   self.db.execute("UPDATE vk_orders SET status='paid',tid=? WHERE id=?",(tid,oid))
   return {'status':'ok'}
  return self.tx(run)
 def order_status(self,uid,oid):
  with self.lock:
   row=self.db.execute('SELECT id,status FROM vk_orders WHERE id=? AND uid=?',(oid,uid)).fetchone()
   if not row:raise Error('UNKNOWN_ORDER',404)
   return {'order':dict(row),'wallet':self.snapshot(uid)}
 def progress(self,uid):
  with self.lock:
   row=self.db.execute('SELECT data FROM vk_progress WHERE uid=?',(uid,)).fetchone()
   result=json.loads(row['data']) if row else {'version':1,'updated':0}
   result['done']={r['id']:{'stars':r['stars'],'errors':r['errors'],'hints':r['hints'],'time':0} for r in self.db.execute('SELECT * FROM solves WHERE uid=?',(uid,))}
   return result
 def save_progress(self,uid,data):
  if not isinstance(data,dict):raise Error('INVALID_PROGRESS')
  value={k:data[k] for k in ('version','updated','drafts','tutorial','last','settings','daily') if k in data}
  if len(dump(value).encode())>350000:raise Error('PROGRESS_TOO_LARGE',413)
  return self.tx(lambda:(self.db.execute('INSERT INTO vk_progress VALUES(?,?) ON CONFLICT(uid) DO UPDATE SET data=excluded.data',(uid,dump(value))),{'ok':True})[1])

def client_ip(peer,forwarded,trusted):
 proxies=[ipaddress.ip_network(x.strip()) for x in trusted.split(',') if x.strip()]
 def is_proxy(addr):return any(ipaddress.ip_address(addr) in net for net in proxies)
 if forwarded and is_proxy(peer):
  chain=[x.strip() for x in forwarded.split(',')]+[peer]
  while len(chain)>1 and is_proxy(chain[-1]):chain.pop()
  peer=chain[-1]
 return ipv4(peer)

class Handler(BaseHTTPRequestHandler):
 store=None;limiter={};limiter_lock=threading.Lock()
 server_version='Nonogram';sys_version=''
 def log_message(self,fmt,*args):logging.info('%s %s',self.command,urlsplit(self.path).path)
 def setup(self):super().setup();self.connection.settimeout(20)
 def send(self,value,status=200):
  raw=dump(value).encode();self.send_response(status)
  for k,v in {'Content-Type':'application/json; charset=utf-8','Content-Length':str(len(raw)),'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}.items():self.send_header(k,v)
  self.end_headers();self.wfile.write(raw)
 def do_GET(self):self.run_request()
 def do_POST(self):self.run_request()
 def run_request(self):
  route=urlsplit(self.path);callback=route.path=='/api/vkplay/callback'
  try:
   if len(self.path)>32768:raise Error('URL_TOO_LONG',414)
   if route.path=='/health' and self.command=='GET':return self.send({'ok':True,'version':VERSION,'configured':self.store is not None,'billingEnabled':bool(self.store and self.store.billing_enabled)})
   if route.path=='/ready' and self.command=='GET':
    if self.store is None:return self.send({'ready':False,'reason':'VKPLAY_NOT_CONFIGURED'},503)
    with self.store.lock:self.store.db.execute('SELECT 1 FROM vk_transactions LIMIT 1').fetchone()
    return self.send({'ready':True,'version':VERSION,'billingEnabled':self.store.billing_enabled})
   if self.store is None:
    return self.send({'status':'error','errcode':0,'errmsg':'RETRY_LATER'} if callback else {'error':'VKPLAY_NOT_CONFIGURED'},200 if callback else 503)
   if callback:
    if self.command!='GET':raise Error('METHOD_NOT_ALLOWED',405)
    params=parse_qs(route.query,keep_blank_values=True,max_num_fields=16)
    if any(len(v)!=1 for v in params.values()):raise Error('DUPLICATE_PARAMETER')
    return self.send(self.store.callback({k:v[0] for k,v in params.items()}))
   ip=client_ip(self.client_address[0],','.join(self.headers.get_all('X-Forwarded-For',[])),getattr(self,'trusted_proxies',os.environ.get('TRUSTED_PROXY_IPS','')))
   with self.limiter_lock:
    now=int(time.time()//60);key=(ip,now)
    Handler.limiter={k:v for k,v in Handler.limiter.items() if k[1]>=now-1}
    Handler.limiter[key]=Handler.limiter.get(key,0)+1
    if Handler.limiter[key]>120:raise Error('RATE_LIMIT',429)
   data={}
   if self.command=='POST':
    if self.headers.get('Transfer-Encoding') or len(self.headers.get_all('Content-Length',[]))>1:raise Error('INVALID_REQUEST')
    length=int(self.headers.get('Content-Length','0'))
    if not 0<=length<=524288:raise Error('BODY_TOO_LARGE',413)
    data=json.loads(self.rfile.read(length) or b'{}')
    if not isinstance(data,dict):raise Error('INVALID_JSON')
   if route.path=='/api/vkplay/auth' and self.command=='POST':return self.send(self.store.auth_vk(data.get('uid'),data.get('otp'),ip))
   uid=self.store.authenticated(self.headers.get('Authorization','').removeprefix('Bearer '))
   if route.path=='/api/wallet' and self.command=='GET':value={'wallet':self.store.wallet(uid)}
   elif route.path=='/api/catalog' and self.command=='GET':value=self.store.catalog(uid)
   elif route.path=='/api/vkplay/order' and self.command=='POST':value=self.store.order(uid,data.get('product'),data.get('requestId'),ip)
   elif route.path=='/api/vkplay/order' and self.command=='GET':value=self.store.order_status(uid,parse_qs(route.query).get('id',[''])[0])
   elif route.path=='/api/progress' and self.command=='POST':value=self.store.save_progress(uid,data)
   elif route.path=='/api/progress' and self.command=='GET':value={'progress':self.store.progress(uid)}
   elif route.path=='/api/action' and self.command=='POST':value=self.store.action(uid,data.get('operationId'),data.get('kind'),data.get('payload') or {})
   elif route.path=='/api/rank/start' and self.command=='POST':value=self.store.begin(uid,data.get('slot'))
   elif route.path=='/api/rank/finish' and self.command=='POST':value=self.store.finish(uid,data.get('ticket'),data.get('cells'),data.get('errors'),data.get('hints'))
   elif route.path=='/api/rank' and self.command=='GET':value=self.store.board(uid,parse_qs(route.query).get('kind',['daily'])[0])
   else:raise Error('NOT_FOUND',404)
   self.send(value)
  except Error as e:self.send({'status':'error','errcode':1,'errmsg':e.code} if callback else {'error':e.code},200 if callback else e.status)
  except (ValueError,TypeError,KeyError):self.send({'status':'error','errcode':1,'errmsg':'INVALID_REQUEST'} if callback else {'error':'INVALID_REQUEST'},200 if callback else 400)
  except Exception:
   logging.error('Request failed: %s',route.path) # never log OTP, receipt or signed URL
   self.send({'status':'error','errcode':0,'errmsg':'RETRY_LATER'} if callback else {'error':'SERVICE_UNAVAILABLE'},200 if callback else 503)

class ServiceHTTPServer(ThreadingHTTPServer):
 daemon_threads=False
 request_queue_size=64
 def __init__(self,address,handler,max_requests=32):
  self.slots=threading.BoundedSemaphore(max_requests)
  super().__init__(address,handler)
 def process_request(self,request,client_address):
  if not self.slots.acquire(blocking=False):
   try:
    request.settimeout(1);request.sendall(b'HTTP/1.1 503 Service Unavailable\r\nContent-Length: 0\r\nConnection: close\r\nRetry-After: 1\r\n\r\n')
   except OSError:pass
   finally:self.shutdown_request(request)
   return
  try:super().process_request(request,client_address)
  except BaseException:self.slots.release();raise
 def process_request_thread(self,request,client_address):
  try:super().process_request_thread(request,client_address)
  finally:self.slots.release()

def create_server(config):
 config.data_dir.mkdir(parents=True,exist_ok=True)
 probe=config.data_dir/('.write-check-'+secrets.token_hex(8))
 try:
  with probe.open('xb') as f:f.write(b'');f.flush();os.fsync(f.fileno())
 finally:probe.unlink(missing_ok=True)
 store=None
 if config.configured:
  api=VKPlay(config.app_id,config.secret,payment_hosts=config.payment_hosts)
  products={key:{**value,'itemDefId':config.item_ids.get(key,value['itemDefId'])} for key,value in PRODUCTS.items()}
  store=Store(str(config.data_dir/'vkplay.sqlite3'),api,config.billing_enabled,products=products)
 handler=type('ConfiguredHandler',(Handler,),{'store':store,'trusted_proxies':config.trusted_proxies})
 try:return ServiceHTTPServer((config.bind,config.port),handler,config.max_requests)
 except BaseException:
  if store:store.db.close()
  raise

def serve():
 logging.basicConfig(level=logging.INFO,format='%(asctime)s %(levelname)s %(message)s')
 try:config=load_settings()
 except ConfigurationError as e:raise SystemExit(str(e)) from None
 server=create_server(config)
 stopping=threading.Event()
 def stop(*_):
  if not stopping.is_set():
   stopping.set();threading.Thread(target=server.shutdown,daemon=True).start()
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
 logging.info('Nonogram backend started; configured=%s billing=%s',config.configured,config.billing_enabled)
 try:server.serve_forever(poll_interval=0.2)
 finally:
  server.server_close()
  if server.RequestHandlerClass.store:server.RequestHandlerClass.store.db.close()
  logging.info('Nonogram backend stopped')
if __name__=='__main__':serve()
