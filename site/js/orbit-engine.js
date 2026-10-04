// Pure, seeded rules. A turn is committed atomically before its visual replay.
export const SIZE = 8;
export const CHARGE = 36;
export const VERSION = 2;
export const KINDS = ['Бирюза', 'Рубин', 'Янтарь', 'Аметист', 'Сапфир', 'Хризолит'];
export const SECTORS = [
  {name:'Кольца Авроры', color:'#65e8d3', subtitle:'Сигнал из забытой обсерватории', story:'Корабль «Искра» поймал сигнал древнего маяка. Соберите энергию и найдите первые фрагменты звёздного атласа.', event:'Спокойная орбита', artifact:'Линза Авроры'},
  {name:'Пояс Титана', color:'#ffc77b', subtitle:'Экспедиция сквозь астероиды', story:'Координаты ведут в пояс обломков. Под каменной корой спрятан ключ к следующему сектору. Звёздный дождь поможет расчистить путь.', event:'Звёздный дождь каждые 5 ходов', artifact:'Сердце Титана'},
  {name:'Туманность Эха', color:'#b69aff', subtitle:'Там, где гравитация меняет путь', story:'Последний маяк затерян в живой туманности. Гравитация поворачивается: планируйте цепочки и соберите атлас экспедиции.', event:'Поворот гравитации каждые 4 хода', artifact:'Компас Эха'}
];
// Each mission has its own objectives and obstacle layout, not a score multiplier.
const specs = [
 ['Первый сигнал',22,1000,[],0,0,'none'],
 ['Спектр Авроры',24,0,[[0,14]],0,0,'none'],
 ['Каменная пыль',26,0,[],8,0,'diagonal'],
 ['Забытая капсула',27,0,[[2,12]],6,2,'islands'],
 ['Двойной спектр',27,0,[[1,15],[4,15]],0,0,'none'],
 ['Кольцо обломков',28,1600,[],12,0,'ring'],
 ['След маяка',29,0,[[3,16]],10,3,'comet'],
 ['Линза Авроры',30,2000,[],12,3,'cross'],
 ['Вход в пояс',28,0,[],12,0,'diagonal'],
 ['Янтарная буря',28,0,[[2,20]],8,0,'islands'],
 ['Кора древних',30,0,[],12,2,'ring'],
 ['Солнечный парус',29,2100,[[0,16]],0,0,'none'],
 ['Осколки станции',30,0,[[4,20]],14,2,'comet'],
 ['Два пульсара',30,0,[[1,20],[3,20]],6,0,'cross'],
 ['Архив Титана',31,0,[],16,4,'islands'],
 ['Сердце Титана',32,2300,[],16,4,'ring'],
 ['Иная гравитация',28,1600,[[3,16]],0,0,'none'],
 ['Поворот судьбы',30,0,[],12,0,'cross'],
 ['Отголоски света',31,0,[[0,20],[5,20]],8,0,'diagonal'],
 ['Скрытый меридиан',32,0,[],14,3,'comet'],
 ['Зеркало туманности',31,2400,[[4,20]],0,0,'none'],
 ['Узел пространства',32,0,[[1,22]],16,3,'ring'],
 ['Последний маяк',33,0,[],18,4,'cross'],
 ['Компас Эха',34,2700,[[3,20]],18,4,'islands']
];
export const LEVELS=specs.map((a,i)=>({id:i+1,sector:Math.floor(i/8),name:a[0],moves:a[1],score:a[2],collect:a[3],rocks:a[4],relics:a[5],layout:a[6],armored:i>=10,colors:i<4?5:6}));
export const clone=x=>JSON.parse(JSON.stringify(x));
export const adjacent=(a,b)=>Number.isInteger(a)&&Number.isInteger(b)&&a>=0&&b>=0&&a<64&&b<64&&Math.abs(a%8-b%8)+Math.abs((a/8|0)-(b/8|0))===1;
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
function shuffled(s,a){const out=[...a];for(let i=out.length-1;i>0;i--){const j=Math.floor(random(s)*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
function gem(s){return {id:s.nextId++,kind:Math.floor(random(s)*LEVELS[s.level-1].colors),special:null};}
export function groups(board){
 const runs=[];
 for(let axis=0;axis<2;axis++)for(let line=0;line<8;line++){
  let at=0;while(at<8){const index=n=>axis?n*8+line:line*8+n,first=index(at),kind=board[first]?.kind;let end=at+1;
   while(kind!==undefined&&end<8&&board[index(end)]?.kind===kind)end++;
   if(kind!==undefined&&end-at>=3)runs.push({cells:Array.from({length:end-at},(_,j)=>index(at+j)),axis:axis?'column':'row'});at=end;
  }
 }
 const out=[];for(const run of runs){let merged={cells:new Set(run.cells),runs:[run]};for(let i=out.length-1;i>=0;i--){if([...merged.cells].some(n=>out[i].cells.has(n))){for(const n of out[i].cells)merged.cells.add(n);merged.runs.push(...out[i].runs);out.splice(i,1);}}out.push(merged);}
 return out.map(g=>({cells:[...g.cells],special:g.runs.some(r=>r.cells.length>=5)?'prism':g.runs.length>1?'nova':g.runs[0].cells.length===4?g.runs[0].axis:null}));
}
function swapOK(board,a,b){
 if(!adjacent(a,b))return false;
 if(board[a]?.special==='prism'||board[b]?.special==='prism'||(board[a]?.special&&board[b]?.special))return true;
 const out=[...board];[out[a],out[b]]=[out[b],out[a]];return groups(out).some(g=>g.cells.includes(a)||g.cells.includes(b));
}
export function legalMoves(s){const out=[];for(let i=0;i<64;i++)for(const j of [i%8<7?i+1:-1,i<56?i+8:-1])if(j>=0&&swapOK(s.board,i,j))out.push([i,j]);return out;}
export function hint(s){return legalMoves(s)[0]||null;}
function populate(s){
 s.board=[];for(let i=0;i<64;i++){const t=gem(s),choices=Array.from({length:LEVELS[s.level-1].colors},(_,k)=>k).filter(k=>!(i%8>=2&&s.board[i-1]?.kind===k&&s.board[i-2]?.kind===k)&&!(i>=16&&s.board[i-8]?.kind===k&&s.board[i-16]?.kind===k));t.kind=choices[Math.floor(random(s)*choices.length)];s.board.push(t);}
}
export function ensureMoves(s){
 if(hint(s)&&!groups(s.board).length)return false;
 // Keep every special and gem identity, and keep the geological layer fixed.
 for(let t=0;t<100;t++){s.board=shuffled(s,s.board);if(!groups(s.board).length&&hint(s))return true;}
 const specials=s.board.filter(t=>t.special).map(t=>t.special);do{populate(s);}while(!hint(s));specials.forEach((v,i)=>s.board[i].special=v);return true;
}
function rockPositions(s,count,layout){
 const all=Array.from({length:64},(_,i)=>i),rank=i=>{const x=i%8,y=i/8|0;switch(layout){case'ring':return Math.abs(Math.hypot(x-3.5,y-3.5)-2.5);case'cross':return Math.min(Math.abs(x-3.5),Math.abs(y-3.5));case'diagonal':return Math.min(Math.abs(x-y),Math.abs(x+y-7));case'comet':return Math.abs(x-y)+x*.16;default:return Math.min(...[9,14,49,54].map(n=>Math.hypot(x-n%8,y-(n/8|0))));}};
 return shuffled(s,all).sort((a,b)=>rank(a)-rank(b)).slice(0,count);
}
export function createRun(level=1,seed=Date.now()>>>0){
 level=Math.max(1,Math.min(24,Math.floor(Number(level)||1)));const l=LEVELS[level-1];
 const s={version:VERSION,level,seed:seed>>>0,nextId:1,board:[],rocks:Array(64).fill(0),relics:Array(64).fill(false),collected:Array(6).fill(0),clearedRocks:0,foundRelics:0,score:0,moves:l.moves,energy:0,drills:2,turn:0,maxCombo:0,gravity:0,done:false,won:false};
 populate(s);ensureMoves(s);const positions=rockPositions(s,l.rocks,l.layout);positions.forEach((n,i)=>s.rocks[n]=l.armored&&i%3===0?2:1);shuffled(s,positions).slice(0,l.relics).forEach(n=>s.relics[n]=true);return s;
}
export function objectives(s){const l=LEVELS[s.level-1],out=[];if(l.score)out.push({type:'score',label:'Энергия',value:s.score,target:l.score});for(const [kind,target]of l.collect)out.push({type:'color',kind,label:KINDS[kind],value:s.collected[kind],target});if(l.rocks)out.push({type:'rocks',label:'Астероиды',value:s.clearedRocks,target:l.rocks});if(l.relics)out.push({type:'relics',label:'Артефакты',value:s.foundRelics,target:l.relics});return out;}
export const completed=s=>objectives(s).every(g=>g.value>=g.target);
export function stars(s){if(!s.won)return 0;return s.moves>=Math.ceil(LEVELS[s.level-1].moves*.32)?3:s.moves>=Math.ceil(LEVELS[s.level-1].moves*.12)?2:1;}
const line=(n,axis)=>Array.from({length:8},(_,j)=>axis==='row'?(n/8|0)*8+j:j*8+n%8);
const area=(n,r=1)=>Array.from({length:64},(_,i)=>i).filter(i=>Math.abs(i%8-n%8)<=r&&Math.abs((i/8|0)-(n/8|0))<=r);
export function footprint(s,n,special,kind=s.board[n]?.kind){if(special==='row'||special==='column')return line(n,special);if(special==='nova')return area(n);if(special==='prism')return s.board.flatMap((g,i)=>g?.kind===kind?[i]:[]);return [n];}
function collapse(s){
 const from=new Map(s.board.flatMap((g,i)=>g?[[g.id,i]]:[])),motion=[];
 for(let lineIndex=0;lineIndex<8;lineIndex++){
  const indices=Array.from({length:8},(_,j)=>s.gravity===0?(7-j)*8+lineIndex:s.gravity===1?lineIndex*8+j:s.gravity===2?j*8+lineIndex:lineIndex*8+7-j);
  const pieces=indices.map(i=>s.board[i]).filter(Boolean);while(pieces.length<8)pieces.push(gem(s));
  indices.forEach((index,j)=>{const tile=pieces[j];s.board[index]=tile;motion.push({id:tile.id,from:from.get(tile.id)??null,to:index});});
 }return motion;
}
function resolveWave(s,matched,forced,combo,preferred,events){
 const clearing=new Set(forced||[]),hit=new Set(forced||[]),spawns=[],effects=[];
 for(const g of matched){g.cells.forEach(n=>hit.add(n));let anchor=-1;if(g.special&&!g.cells.some(n=>s.board[n]?.special)){anchor=preferred.find(n=>g.cells.includes(n))??g.cells[Math.floor(g.cells.length/2)];spawns.push({index:anchor,special:g.special});}
  g.cells.forEach(n=>{if(n!==anchor)clearing.add(n);});
 }
 const activated=new Set();let pending=true;while(pending){pending=false;for(const n of [...clearing]){const spec=s.board[n]?.special;if(spec&&!activated.has(n)){activated.add(n);pending=true;effects.push({index:n,special:spec});for(const i of footprint(s,n,spec))clearing.add(i);}}}
 for(const n of clearing)hit.add(n);
 const before=clone(s.board),rockBefore=[...s.rocks];let found=0;
 for(const n of hit){if(s.rocks[n]>0){s.rocks[n]--;if(s.rocks[n]===0)s.clearedRocks++;}if(s.rocks[n]===0&&s.relics[n]){s.relics[n]=false;s.foundRelics++;found++;}}
 for(const n of clearing){if(s.board[n]){s.collected[s.board[n].kind]++;s.board[n]=null;}}
 for(const p of spawns)if(s.board[p.index]){s.board[p.index].special=p.special;effects.push({...p,created:true});}
 const gain=clearing.size*50*combo;s.score+=gain;s.energy=Math.min(CHARGE,s.energy+clearing.size);s.maxCombo=Math.max(s.maxCombo,combo);
 if(found)events.push({type:'relic',count:found});
 const clearState=clone(s),motion=collapse(s);return {type:'clear',before,rockBefore,cleared:[...clearing],hit:[...hit],effects,combo,gain,clearState,state:clone(s),motion};
}
export function act(input,action){
 if(input.done)return {ok:false,reason:'finished'};const s=clone(input),frames=[],events=[];let forced=null,preferred=[];
 if(action.type==='swap'){
  const {a,b}=action;if(!swapOK(s.board,a,b))return {ok:false,reason:'invalid'};
  const ga=s.board[a],gb=s.board[b];[s.board[a],s.board[b]]=[gb,ga];s.moves--;s.turn++;preferred=[b,a];frames.push({type:'swap',a,b,state:clone(s)});
  if(ga.special==='prism'||gb.special==='prism'){
   if(ga.special==='prism'&&gb.special==='prism')forced=Array.from({length:64},(_,i)=>i);
   else{const target=ga.special==='prism'?gb:ga,source=ga.special==='prism'?b:a;s.board[source].kind=target.kind;forced=[a,b,...footprint(s,source,'prism',target.kind)];if(target.special)for(const i of forced)if(s.board[i].special!=='prism')s.board[i].special=target.special;}
   events.push({type:'special',label:'Спектральный разряд'});
  }else if(ga.special&&gb.special){
   if(ga.special==='nova'&&gb.special==='nova')forced=area(b,2);
   else if(ga.special==='nova'||gb.special==='nova'){forced=[];for(let d=-1;d<=1;d++){if((b/8|0)+d>=0&&(b/8|0)+d<8)forced.push(...line(b+d*8,'row'));if(b%8+d>=0&&b%8+d<8)forced.push(...line(b+d,'column'));}}
   else forced=[...line(b,'row'),...line(b,'column')];forced.push(a,b);events.push({type:'special',label:'Орбитальное комбо'});
  }
 }else if(action.type==='pulse'||action.type==='drill'){
  if(!Number.isInteger(action.index)||action.index<0||action.index>=64)return {ok:false,reason:'invalid'};
  if(action.type==='pulse'){if(s.energy<CHARGE)return {ok:false,reason:'charge'};s.energy=0;forced=[...line(action.index,'row'),...line(action.index,'column')];events.push({type:'pulse',index:action.index,label:'Орбитальный импульс'});}
  else{if(s.drills<=0)return {ok:false,reason:'drills'};s.drills--;forced=[action.index];if(s.rocks[action.index]===2)s.rocks[action.index]=1;events.push({type:'drill',index:action.index,label:'Точный удар'});}
 }else return {ok:false,reason:'invalid'};
 let combo=0,matched=groups(s.board);
 while(forced?.length||matched.length){frames.push(resolveWave(s,matched,forced,++combo,preferred,events));forced=null;preferred=[];matched=groups(s.board);if(combo>=64){ensureMoves(s);frames.push({type:'shuffle',state:clone(s)});events.push({type:'shuffle'});break;}}
 // One resonance reward per action. No timer: thoughtful moves get the same reward.
 if(combo>=3){s.energy=Math.min(CHARGE,s.energy+8);events.push({type:'resonance',label:'Резонанс · +8 заряда'});frames.push({type:'resonance',state:clone(s)});}
 if(action.type==='swap'&&!completed(s)){
  const sector=LEVELS[s.level-1].sector;
  if(sector===1&&s.turn%5===0){const targets=shuffled(s,s.rocks.flatMap((v,i)=>v?[i]:[])).slice(0,3);s.energy=Math.min(CHARGE,s.energy+8);events.push({type:'meteor',label:'Звёздный дождь · +8 заряда'});if(targets.length){frames.push(resolveWave(s,[],targets,1,[],events));matched=groups(s.board);let limit=0;while(matched.length&&limit++<64){frames.push(resolveWave(s,matched,null,++combo,[],events));matched=groups(s.board);}}}
  if(sector===2&&s.turn%4===0){s.gravity=(s.gravity+1)%4;events.push({type:'gravity',label:'Гравитация меняет направление'});}
 }
 if(ensureMoves(s)){frames.push({type:'shuffle',state:clone(s)});events.push({type:'shuffle'});}
 s.won=completed(s);s.done=s.won||s.moves===0;return {ok:true,state:s,frames,events};
}
export function validRun(s){
 if(!s||s.version!==VERSION||!Number.isInteger(s.level)||s.level<1||s.level>24)return false;
 const ints=['seed','nextId','moves','score','energy','drills','turn','maxCombo','clearedRocks','foundRelics','gravity'];
 if(ints.some(k=>!Number.isInteger(s[k])||s[k]<0)||s.energy>CHARGE||s.drills>100||s.gravity>3||s.moves>LEVELS[s.level-1].moves)return false;
 if(!Array.isArray(s.board)||s.board.length!==64||s.board.some(t=>!t||!Number.isInteger(t.id)||t.id<=0||!Number.isInteger(t.kind)||t.kind<0||t.kind>=6||![null,'row','column','nova','prism'].includes(t.special)))return false;
 if(new Set(s.board.map(t=>t.id)).size!==64||s.nextId<=Math.max(...s.board.map(t=>t.id)))return false;
 if(!Array.isArray(s.rocks)||s.rocks.length!==64||s.rocks.some(n=>![0,1,2].includes(n)))return false;
 if(!Array.isArray(s.relics)||s.relics.length!==64||s.relics.some(n=>typeof n!=='boolean'))return false;
 if(!Array.isArray(s.collected)||s.collected.length!==6||s.collected.some(n=>!Number.isInteger(n)||n<0))return false;
 if(typeof s.done!=='boolean'||typeof s.won!=='boolean'||s.won!==completed(s)||s.done!==(s.won||s.moves===0))return false;
 return groups(s.board).length===0&&!!hint(s);
}
export function readProgress(raw,legacy=null){
 const p={version:VERSION,unlocked:1,stars:Array(24).fill(0),best:Array(24).fill(0),run:null};
 if(raw?.version===VERSION){for(let i=0;i<24;i++){p.stars[i]=Math.max(0,Math.min(3,Number.isInteger(raw.stars?.[i])?raw.stars[i]:0));p.best[i]=Math.max(0,Number.isFinite(raw.best?.[i])?raw.best[i]:0);}p.unlocked=Math.max(1,Math.min(24,Number.isInteger(raw.unlocked)?raw.unlocked:1));if(validRun(raw.run)&&raw.run.level<=p.unlocked)p.run=clone(raw.run);}
 else if(Number.isInteger(legacy?.level))p.unlocked=Math.max(1,Math.min(24,legacy.level));
 return p;
}
export function record(p,s){p.run=clone(s);if(s.won){p.stars[s.level-1]=Math.max(p.stars[s.level-1],stars(s));p.best[s.level-1]=Math.max(p.best[s.level-1],s.score);p.unlocked=Math.max(p.unlocked,Math.min(24,s.level+1));}return p;}
