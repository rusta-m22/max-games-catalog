// Pair mahjong on a rotatable solid. Generated deals include a surface-peeling solution.
export const VERSION=2;
export const SYMBOLS=['Лотос','Бамбук','Солнце','Кристалл','Луна','Цветок','Волна','Клевер'];
export const COLORS=['#ec6eab','#26bbae','#f5b632','#8b76e7','#578ee5','#f48a55','#42bada','#78b449'];
export const SHAPES=[
 {name:'Фонарь желаний',make:()=>box(3,4,3)},
 {name:'Лунные ворота',make:()=>grid(5,5,2,(x,y)=>x===0||x===4||y>=3)},
 {name:'Сердце мечты',make:()=>grid(5,5,2,(x,y)=>y===4?(x===1||x===3):y>=2?true:y===1?x>=1&&x<=3:x===2)},
 {name:'Парящие башни',make:()=>grid(5,4,2,(x,y)=>x!==2||y===2)},
 {name:'Нефритовая пирамида',make:()=>grid(5,3,5,(x,y,z)=>Math.abs(x-2)<=2-y&&Math.abs(z-2)<=2-y)},
 {name:'Звёздный цветок',make:()=>grid(5,5,2,(x,y)=>Math.abs(x-2)+Math.abs(y-2)<=3)},
 {name:'Дворец облаков',make:()=>grid(5,4,3,(x,y,z)=>y===0||x===0||x===4||(y===3&&z===1))},
 {name:'Кольцо рассвета',make:()=>grid(5,5,2,(x,y)=>Math.max(Math.abs(x-2),Math.abs(y-2))===2)},
 {name:'Крылья бабочки',make:()=>grid(5,5,2,(x,y)=>x===2||Math.abs(x-2)===Math.abs(y-2)||Math.abs(x-2)===2)},
 {name:'Хрустальный мост',make:()=>grid(5,3,3,(x,y,z)=>y===2||(x===0||x===4)&&(z===0||z===2))}
];
function grid(w,h,d,include=()=>true){const a=[];for(let x=0;x<w;x++)for(let y=0;y<h;y++)for(let z=0;z<d;z++)if(include(x,y,z))a.push([x-(w-1)/2,y-(h-1)/2,z-(d-1)/2]);if(a.length%2)a.splice(Math.floor(a.length/2),1);return a;}
function box(w,h,d){return grid(w,h,d);}
export function rng(seed){let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function shuffle(a,random){const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[b[i],b[j]]=[b[j],b[i]];}return b;}
const key=p=>p.join(','),DIRS=[[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
export function exposed(tiles){const active=tiles.filter(t=>!t.removed),occupied=new Set(active.map(t=>key(t.p)));return active.filter(t=>DIRS.some(d=>!occupied.has(key(t.p.map((v,i)=>v+d[i]))))).map(t=>t.id);}
function deal(tiles,kinds,random){const working=tiles.map(t=>({...t,removed:t.removed})),solution=[];for(const kind of shuffle(kinds,random)){const free=shuffle(exposed(working),random);if(free.length<2)throw Error('Layout cannot be peeled');const pair=free.slice(0,2);for(const id of pair){working.find(t=>t.id===id).removed=true;tiles.find(t=>t.id===id).kind=kind;}solution.push(pair);}return solution;}
export function createRun({level=1,round=0,seed=Math.floor(Math.random()*2**32),previous=-1,mode='dream',shape}={}){
 const random=rng(seed),choices=SHAPES.map((_,i)=>i).filter(i=>i!==previous);shape=Number.isInteger(shape)&&shape>=0&&shape<SHAPES.length?shape:round===0&&previous===-1?0:choices[Math.floor(random()*choices.length)];
 const tiles=SHAPES[shape].make().map((p,id)=>({id,p,kind:0,removed:false})),kinds=Array.from({length:tiles.length/2},(_,i)=>i%Math.min(8,4+Math.floor(level/2)));
 const solution=deal(tiles,kinds,random);
 return {version:VERSION,level:Math.max(1,Math.floor(level)),round,seed:seed>>>0,shape,skin:round%3,world:round%3,mode,tiles,solution,rotation:[-.32,.56],selected:null,score:0,combo:0,bestCombo:0,pairs:0,mistakes:0,seconds:Math.max(120,tiles.length*5),started:false,done:false,won:false,shuffles:3,undo:[],revision:0};
}
export function findPair(s){const free=new Set(exposed(s.tiles)),available=s.tiles.filter(t=>free.has(t.id));if(s.selected!==null){const selected=available.find(t=>t.id===s.selected),other=selected&&available.find(t=>t.kind===selected.kind&&t.id!==selected.id);if(other)return[selected.id,other.id];}for(let i=0;i<available.length;i++){const other=available.slice(i+1).find(t=>t.kind===available[i].kind);if(other)return[available[i].id,other.id];}return null;}
export function choose(s,id){
 if(s.done)return{ok:false,reason:'done'};const tile=s.tiles.find(t=>t.id===id);if(!tile||tile.removed||!exposed(s.tiles).includes(id))return{ok:false,reason:'blocked'};
 s.started=true;if(s.selected===id){s.selected=null;return{ok:true,type:'deselect'};}
 const first=s.tiles.find(t=>t.id===s.selected);s.selected=id;
 if(!first)return{ok:true,type:'select'};
 if(first.kind!==tile.kind){s.combo=0;s.mistakes++;return{ok:true,type:'mismatch',ids:[first.id,id]};}
 s.undo.push({ids:[first.id,id],score:s.score,combo:s.combo,bestCombo:s.bestCombo});s.undo=s.undo.slice(-12);first.removed=tile.removed=true;s.selected=null;s.pairs++;s.combo=Math.min(5,s.combo+1);s.bestCombo=Math.max(s.bestCombo,s.combo);const gain=100+25*(s.combo-1);s.score+=gain;s.revision++;
 if(s.tiles.every(t=>t.removed)){s.done=true;s.won=true;}
 return{ok:true,type:'match',ids:[first.id,id],kind:tile.kind,gain};
}
export function undo(s){if(!s.undo.length||s.done)return false;const old=s.undo.pop();old.ids.forEach(id=>s.tiles.find(t=>t.id===id).removed=false);s.score=old.score;s.combo=old.combo;s.bestCombo=old.bestCombo;s.pairs--;s.selected=null;s.revision++;return true;}
export function reshuffle(s){if(s.done)return false;const rescue=!findPair(s);if(!rescue&&s.shuffles<=0)return false;const counts=Array(SYMBOLS.length).fill(0);s.tiles.filter(t=>!t.removed).forEach(t=>counts[t.kind]++);const kinds=counts.flatMap((n,k)=>Array(n/2).fill(k));s.solution=deal(s.tiles,kinds,rng((s.seed+s.revision*7919+101)>>>0));s.selected=null;s.combo=0;s.undo=[];s.revision++;if(!rescue)s.shuffles--;return true;}
export function tick(s,elapsed){if(s.mode!=='timed'||s.done||!s.started)return false;s.seconds=Math.max(0,s.seconds-elapsed);if(!s.seconds){s.done=true;s.won=false;return true;}return false;}
export function validRun(s){
 if(!s||s.version!==VERSION||!Number.isInteger(s.level)||s.level<1||!Number.isInteger(s.shape)||!SHAPES[s.shape]||!Array.isArray(s.tiles)||s.tiles.length<2||s.tiles.length>160||s.tiles.length%2||!['dream','timed'].includes(s.mode)||!Array.isArray(s.rotation)||s.rotation.length!==2||!s.rotation.every(Number.isFinite))return false;
 const ids=new Set(),positions=new Set(),counts=Array(8).fill(0);for(const t of s.tiles){if(!Number.isInteger(t.id)||ids.has(t.id)||!Number.isInteger(t.kind)||t.kind<0||t.kind>7||!Array.isArray(t.p)||t.p.length!==3||!t.p.every(n=>Number.isFinite(n)&&Math.abs(n)<=8)||positions.has(key(t.p))||typeof t.removed!=='boolean')return false;ids.add(t.id);positions.add(key(t.p));if(!t.removed)counts[t.kind]++;}
 return counts.every(n=>n%2===0)&&['score','seconds','pairs','combo','bestCombo','round','seed','shuffles','revision','skin','world','mistakes'].every(k=>Number.isFinite(s[k])&&s[k]>=0)&&s.skin<=2&&s.world<=2&&Array.isArray(s.undo)&&s.undo.every(u=>Array.isArray(u.ids)&&u.ids.length===2&&u.ids.every(id=>ids.has(id))&&[u.score,u.combo,u.bestCombo].every(Number.isFinite))&&(s.selected===null||s.tiles.some(t=>t.id===s.selected&&!t.removed))&&typeof s.done==='boolean'&&typeof s.won==='boolean'&&(!s.won||s.tiles.every(t=>t.removed));
}
export function readProgress(p,legacy){if(p?.version===VERSION&&validRun(p.run)){return{...p,seen:!!p.seen,best:Math.max(0,Number(p.best)||0),cleared:Math.max(0,Number(p.cleared)||0),unlocked:Math.max(1,Number(p.unlocked)||1)};}
 const level=Number.isInteger(legacy?.level)?Math.max(1,Math.min(999,legacy.level)):1;
 return{version:VERSION,seen:false,best:Math.max(0,Number(legacy?.score)||0),unlocked:level,cleared:Math.max(0,level-1),run:createRun({level}),recorded:null,migrated:!!legacy};
}
export function record(p,s){p.run=s;p.best=Math.max(p.best,s.score);const id=`${s.seed}-${s.round}`;if(s.won&&p.recorded!==id){p.unlocked=Math.max(p.unlocked,s.level+1);p.cleared++;p.recorded=id;}return p;}
