// Local, deterministic physics and rules. No DOM, rendering or platform SDK.
export const FIELD = Object.freeze({halfWidth:3.8, back:-7.2, front:10.4, line:5.25, launch:8.55, half:.49, gravity:22, step:1/120});
export const VERSION = 2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const validValue=v=>Number.isSafeInteger(v)&&v>=2&&v<=2**40&&Number.isInteger(Math.log2(v));
export const copyGame=s=>JSON.parse(JSON.stringify(s));

function random(s){let n=s.rng|0;n^=n<<13;n^=n>>>17;n^=n<<5;s.rng=n>>>0;return s.rng/4294967296;}
function nextValue(s){
  const maxExp=clamp(Math.floor(Math.log2(s.maxValue))-2,3,6);
  const r=random(s);return 2**(r<.32?1:r<.61?2:3+Math.floor(random(s)*(maxExp-2)));
}
export function makeBody(s,value,x,z,extra={}){
  return {id:s.nextId++,value,x,y:FIELD.half,z,vx:0,vy:0,vz:0,angle:0,spin:0,cooldown:0,age:1,projectile:false,kind:'normal',...extra};
}
export function createGame(seed=Date.now()){
  const s={version:VERSION,rng:(seed>>>0)||1,nextId:1,time:0,bodies:[],queue:[2,4,8],score:0,maxValue:16,moves:0,merges:0,combo:0,bestCombo:0,phase:'ready',shotTime:0,quiet:0,bombs:2,wilds:1,revived:false,milestone:0,roundId:String(seed),earnedMilestone:128};
  [[-2.55,-5.9,4],[-1.28,-5.9,8],[0,-5.9,2],[1.28,-5.9,16],[2.55,-5.9,4],[-1.9,-4.65,2],[.05,-4.65,4],[1.9,-4.65,2]].forEach(([x,z,value],i)=>s.bodies.push(makeBody(s,value,x,z,{angle:(i%3-1)*.08})));
  return s;
}

// Reject incompatible/corrupt saves, including NaNs, duplicated IDs and absurd sizes.
export function restoreGame(raw){
  try{
    if(raw?.version!==VERSION||!Array.isArray(raw.bodies)||raw.bodies.length>140||!Array.isArray(raw.queue)||raw.queue.length!==3||!raw.queue.every(validValue))return null;
    if(!['ready','flying','over'].includes(raw.phase))return null;
    const s=copyGame(raw),ids=new Set();
    for(const key of ['rng','nextId','time','score','moves','merges','combo','bestCombo','shotTime','quiet','bombs','wilds','maxValue','earnedMilestone'])if(!Number.isFinite(s[key])||s[key]<0)return null;
    if(!validValue(s.maxValue)||!Number.isInteger(s.nextId)||s.bombs>99||s.wilds>99||s.score>Number.MAX_SAFE_INTEGER)return null;
    for(const b of s.bodies){
      if(!Number.isInteger(b.id)||ids.has(b.id)||b.id<=0||b.id>=s.nextId||!['normal','bomb','wild'].includes(b.kind)||(!validValue(b.value)&&!(b.value===0&&b.kind!=='normal')))return null;
      ids.add(b.id);
      for(const k of ['x','y','z','vx','vy','vz','angle','spin','cooldown','age'])if(!Number.isFinite(b[k]))return null;
      if(Math.abs(b.x)>FIELD.halfWidth+1||Math.abs(b.z)>FIELD.front+2||b.y<-.1||b.y>30||Math.hypot(b.vx,b.vy,b.vz)>100)return null;
      b.y=Math.max(FIELD.half,b.y);b.cooldown=clamp(b.cooldown,0,.4);
    }
    if(s.phase==='ready'&&s.bodies.some(b=>Math.hypot(b.vx,b.vy,b.vz)>.2||b.y>FIELD.half+.05))s.phase='flying';
    return s;
  }catch{return null;}
}

export function launch(s,x,kind='normal'){
  if(s.phase!=='ready'||!Number.isFinite(x)||!['normal','bomb','wild'].includes(kind))return false;
  if(kind==='bomb'&&s.bombs<1||kind==='wild'&&s.wilds<1)return false;
  const value=kind==='normal'?s.queue.shift():0;
  if(kind==='normal')s.queue.push(nextValue(s));
  if(kind==='bomb')s.bombs--;if(kind==='wild')s.wilds--;
  s.bodies.push(makeBody(s,value,clamp(x,-FIELD.halfWidth+.73,FIELD.halfWidth-.73),FIELD.launch,{vz:-25.5,projectile:true,kind,age:0}));
  s.phase='flying';s.moves++;s.combo=0;s.shotTime=0;s.quiet=0;return true;
}

function footprint(b){const c=Math.cos(b.angle),q=Math.sin(b.angle);return [[c,q],[-q,c]];}
function radius(axes,nx,nz){return FIELD.half*(Math.abs(axes[0][0]*nx+axes[0][1]*nz)+Math.abs(axes[1][0]*nx+axes[1][1]*nz));}
// Separating axis theorem for upright, rotating cuboids, including vertical stacking.
export function contact(a,b){
  const dx=b.x-a.x,dy=b.y-a.y,dz=b.z-a.z;
  if(Math.abs(dx)>1.42||Math.abs(dz)>1.42||Math.abs(dy)>.982)return null;
  const aa=footprint(a),bb=footprint(b);let pen=.98-Math.abs(dy),nx=0,ny=dy>=0?1:-1,nz=0;
  for(const axis of [...aa,...bb]){
    const d=dx*axis[0]+dz*axis[1],over=radius(aa,...axis)+radius(bb,...axis)-Math.abs(d);
    if(over<-.001)return null;
    if(over<pen){pen=over;const sign=d>=0?1:-1;nx=axis[0]*sign;ny=0;nz=axis[1]*sign;}
  }
  return pen>=-.001?{nx,ny,nz,pen}:null;
}

function bounds(b,events,s){
  const half=FIELD.half*(Math.abs(Math.cos(b.angle))+Math.abs(Math.sin(b.angle)));
  if(b.y<FIELD.half){
    b.y=FIELD.half;
    if(b.vy<0){const impact=-b.vy;b.vy=impact>1.6?impact*.22:0;if(impact>2.5)events.push({type:'land',id:b.id,x:b.x,z:b.z,speed:impact});}
  }
  if(b.x<-FIELD.halfWidth+half||b.x>FIELD.halfWidth-half){
    const side=b.x<0?-1:1;b.x=side*(FIELD.halfWidth-half);
    if(b.vx*side>0){b.vx*=-.42;b.spin*=.6;b.projectile=false;}
  }
  if(b.z<FIELD.back+half){
    b.z=FIELD.back+half;
    if(b.kind==='bomb'){explode(s,b,events);return;}
    if(b.vz<0){b.vz*=-.36;b.projectile=false;events.push({type:'wall',x:b.x,z:b.z});}
  }
  if(b.z>FIELD.front-half){b.z=FIELD.front-half;if(b.vz>0)b.vz*=-.22;b.projectile=false;}
}

function explode(s,b,events){
  const removed=s.bodies.filter(o=>o.id===b.id||Math.hypot(o.x-b.x,o.z-b.z)<2.45&&Math.abs(o.y-b.y)<2.4);
  const ids=new Set(removed.map(o=>o.id));s.bodies=s.bodies.filter(o=>!ids.has(o.id));
  for(const o of s.bodies){const dx=o.x-b.x,dz=o.z-b.z,d=Math.hypot(dx,dz);if(d<3.5&&d>.01){o.vx+=dx/d*.6;o.vz+=dz/d*.6;o.projectile=false;}}
  s.quiet=0;events.push({type:'blast',x:b.x,y:b.y,z:b.z,ids:[...ids],count:removed.length-1});
}

function merge(s,a,b,events){
  const value=Math.max(a.value,b.value)*2;
  if(value>2**40)return false;
  s.bodies=s.bodies.filter(o=>o!==a&&o!==b);
  const x=(a.x+b.x)*.5,z=clamp((a.z+b.z)*.5-.12,FIELD.back+.8,FIELD.front-1),y=Math.max(FIELD.half,Math.min(a.y,b.y))+.12;
  const result=makeBody(s,value,x,z,{y,vy:3.6,vx:(a.vx+b.vx)*.14,vz:clamp((a.vz+b.vz)*.12,-2.4,1),angle:(a.angle+b.angle)*.5,spin:.8,cooldown:.16,age:0});
  // A small merge impulse towards a nearby match makes chains readable, without teleporting.
  const target=s.bodies.filter(o=>o.value===value&&o.kind==='normal'&&Math.hypot(o.x-x,o.z-z)<1.95).sort((p,q)=>Math.hypot(p.x-x,p.z-z)-Math.hypot(q.x-x,q.z-z))[0];
  if(target){const d=Math.max(.1,Math.hypot(target.x-x,target.z-z));result.vx+=(target.x-x)/d*2.2;result.vz+=(target.z-z)/d*2.2;}
  s.bodies.push(result);s.combo++;s.merges++;s.score+=value;s.maxValue=Math.max(s.maxValue,value);s.bestCombo=Math.max(s.bestCombo,s.combo);s.quiet=0;
  events.push({type:'merge',ids:[a.id,b.id],id:result.id,x,y,z,value,combo:s.combo,score:value});
  if(value>s.earnedMilestone&&value>=256){s.earnedMilestone=value;const gained=s.bombs<3?1:0;s.bombs+=gained;events.push({type:'bonus',value,gained});}
  if(value>=2048&&value>(s.milestone||0)){s.milestone=value;events.push({type:'milestone',value});}
  if(s.phase==='ready'){s.phase='flying';s.shotTime=0;}
  return true;
}

function resolve(a,b,c){
  const {nx,ny,nz,pen}=c,correction=Math.max(0,pen-.002)*.51;
  a.x-=nx*correction;a.y-=ny*correction;a.z-=nz*correction;
  b.x+=nx*correction;b.y+=ny*correction;b.z+=nz*correction;
  const vx=b.vx-a.vx,vy=b.vy-a.vy,vz=b.vz-a.vz,normal=vx*nx+vy*ny+vz*nz;
  if(normal<0){
    const restitution=normal<-1?.23:0,j=-(1+restitution)*normal*.5;
    a.vx-=j*nx;a.vy-=j*ny;a.vz-=j*nz;b.vx+=j*nx;b.vy+=j*ny;b.vz+=j*nz;
    if(!ny){const tangent=(vx*-nz+vz*nx)*.045;a.vx-=nz*tangent;a.vz+=nx*tangent;b.vx+=nz*tangent;b.vz-=nx*tangent;
      const spin=clamp((vx*nz-vz*nx)*.16,-2,2);a.spin+=spin;b.spin-=spin;
    }
  }
  a.projectile=false;b.projectile=false;
}

export function stepGame(s,dt=FIELD.step){
  const events=[];
  if(s.phase==='over'||!Number.isFinite(dt)||dt<=0)return events;
  dt=Math.min(dt,1/60);s.time+=dt;
  if(s.phase==='flying')s.shotTime+=dt;
  for(const b of [...s.bodies]){
    b.age+=dt;b.cooldown=Math.max(0,b.cooldown-dt);
    b.vy-=FIELD.gravity*dt;
    const damping=Math.exp(-(b.projectile ? .13 : 2.8)*dt);
    b.vx*=damping;b.vz*=damping;b.spin*=Math.exp(-4*dt);
    if(!b.projectile&&b.y<=FIELD.half+.03){const speed=Math.hypot(b.vx,b.vz),factor=Math.max(0,1-1.8*dt/Math.max(speed,.001));b.vx*=factor;b.vz*=factor;}
    b.x+=b.vx*dt;b.y+=b.vy*dt;b.z+=b.vz*dt;b.angle+=b.spin*dt;
    bounds(b,events,s);
  }
  for(let iteration=0;iteration<4;iteration++){
    const list=[...s.bodies],removed=new Set();
    for(let i=0;i<list.length;i++)for(let j=i+1;j<list.length;j++){
      const a=list[i],b=list[j];if(removed.has(a.id)||removed.has(b.id))continue;
      const c=contact(a,b);if(!c)continue;
      if(a.kind==='bomb'||b.kind==='bomb'){
        const bomb=a.kind==='bomb'?a:b;const before=s.bodies;explode(s,bomb,events);const remaining=new Set(s.bodies.map(o=>o.id));for(const o of before)if(!remaining.has(o.id))removed.add(o.id);continue;
      }
      if(a.cooldown===0&&b.cooldown===0&&(a.value===b.value||a.kind==='wild'||b.kind==='wild')&&(a.value||b.value)){
        if(merge(s,a,b,events)){removed.add(a.id);removed.add(b.id);continue;}
      }
      resolve(a,b,c);
    }
    for(const b of [...s.bodies])bounds(b,events,s);
  }
  if(s.phase==='flying'){
    const moving=s.bodies.some(b=>Math.hypot(b.vx,b.vy,b.vz)>.17||Math.abs(b.spin)>.12||b.cooldown>0);
    s.quiet=moving?0:s.quiet+dt;
    if(s.quiet>.32&&s.shotTime>.65||s.shotTime>9){
      // After prolonged contact jitter, stop horizontal drift. Gravity remains active.
      if(s.shotTime>9&&s.bodies.some(b=>b.y>FIELD.half+.05&&Math.abs(b.vy)>.5)){for(const b of s.bodies){b.vx=0;b.vz=0;b.spin=0;}return events;}
      for(const b of s.bodies){b.vx=0;b.vy=0;b.vz=0;b.spin=0;b.projectile=false;}
      // A fired cube cannot lose while crossing the line; evaluate only the settled board.
      const danger=s.bodies.some(b=>b.z+FIELD.half>FIELD.line+.04);
      s.phase=danger||s.bodies.length>=115?'over':'ready';s.quiet=0;
      events.push({type:s.phase==='over'?'over':'settled',score:s.score,combo:s.combo});
    }
  }
  return events;
}

export function revive(s){
  if(s.phase!=='over'||s.revived)return false;
  const front=s.bodies.filter(b=>b.z+FIELD.half>FIELD.line-1.4).map(b=>b.id);
  const removed=new Set(front.length?front:s.bodies.slice().sort((a,b)=>b.z-a.z).slice(0,6).map(b=>b.id));
  s.bodies=s.bodies.filter(b=>!removed.has(b.id));s.phase='flying';s.shotTime=0;s.quiet=0;s.revived=true;return true;
}
