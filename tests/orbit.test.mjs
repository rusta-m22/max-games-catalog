import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARGE,LEVELS,createRun,groups,act,hint,legalMoves,objectives,ensureMoves,footprint,validRun,readProgress,record,stars,clone} from '../site/js/orbit-engine.js';

test('Orbit: all 24 missions start without matches, with a legal move and correct objective layers',()=>{
 assert.equal(LEVELS.length,24);
 for(let level=1;level<=24;level++)for(let seed=0;seed<20;seed++){
  const s=createRun(level,seed);assert(validRun(s));assert.equal(s.rocks.filter(Boolean).length,LEVELS[level-1].rocks);assert.equal(s.relics.filter(Boolean).length,LEVELS[level-1].relics);assert(objectives(s).length>0);assert.deepEqual(s,createRun(level,seed));
 }
});
test('Orbit: illegal swaps never change state or consume moves',()=>{
 const s=createRun(1,1),before=clone(s);for(const [a,b]of [[0,63],[-1,0],[7,8],[1.5,2],[0,999]])assert.equal(act(s,{type:'swap',a,b}).ok,false);
 assert.equal(act(s,{type:'drill',index:NaN}).ok,false);assert.equal(act(s,{type:'pulse',index:0}).ok,false);assert.deepEqual(s,before);
});
test('Orbit: four, five and crossing matches produce distinct specials',()=>{
 const b=Array(64).fill(null);const fill=(xs,k=0)=>xs.forEach(i=>b[i]={id:i+1,kind:k,special:null});
 fill([24,25,26,27]);assert.equal(groups(b)[0].special,'row');fill([28]);assert.equal(groups(b)[0].special,'prism');
 b.fill(null);fill([19,27,35,26,28]);assert.equal(groups(b)[0].special,'nova');
 b.fill(null);fill([2,10,18,26]);assert.equal(groups(b)[0].special,'column');
});
test('Orbit: a real four-match creates a usable beam at the swapped destination',()=>{
 const s=createRun(1,45);s.board.forEach((t,i)=>t.kind=(i%8+2*(i/8|0))%6);for(const i of [25,26,28,19])s.board[i].kind=0;s.board[27].kind=1;s.board[24].kind=2;
 assert.equal(groups(s.board).length,0);const r=act(s,{type:'swap',a:19,b:27});assert(r.ok);assert(r.frames.some(f=>f.effects?.some(e=>e.created&&e.special==='row'&&e.index===27)));assert(validRun(r.state));
});
test('Orbit: beam combinations chain once per crystal and consume one move',()=>{
 const s=createRun(3,7);s.board[27].special='row';s.board[28].special='column';const r=act(s,{type:'swap',a:27,b:28});assert(r.ok);assert.equal(r.state.moves,s.moves-1);const f=r.frames.find(f=>f.type==='clear');assert(f.cleared.length>=15);assert.equal(new Set(f.cleared).size,f.cleared.length);assert(validRun(r.state));
});
test('Orbit: prism takes the partner color, not a second unrelated color',()=>{
 const s=createRun(3,11);s.board[0].special='prism';const kind=s.board[1].kind;s.board[0].kind=(kind+1)%6;
 const r=act(s,{type:'swap',a:0,b:1});assert(r.ok);const f=r.frames.find(f=>f.type==='clear');for(const i of f.cleared)assert(i===1||f.before[i].kind===kind);assert(validRun(r.state));
});
test('Orbit: double prism clears all 64 cells; nova + beam expands to three lines',()=>{
 let s=createRun(8,9);s.board[9].special=s.board[10].special='prism';let r=act(s,{type:'swap',a:9,b:10});assert.equal(r.frames.find(f=>f.type==='clear').cleared.length,64);assert(validRun(r.state));
 s=createRun(8,9);s.board[27].special='nova';s.board[28].special='row';r=act(s,{type:'swap',a:27,b:28});assert(r.frames.find(f=>f.type==='clear').cleared.length>=39);assert(validRun(r.state));
});
test('Orbit: pulse clears its cross for charge; drill penetrates two layers without spending a move',()=>{
 let s=createRun(11,1);s.energy=CHARGE;let r=act(s,{type:'pulse',index:27});assert(r.ok);assert.equal(r.state.moves,s.moves);assert.equal(r.frames[0].cleared.length,15);assert(r.state.energy<=CHARGE);assert(validRun(r.state));
 const i=s.rocks.findIndex(v=>v===2);s.relics[i]=true;r=act(s,{type:'drill',index:i});assert(r.ok);assert.equal(r.state.drills,s.drills-1);assert.equal(r.state.moves,s.moves);assert.equal(r.state.rocks[i],0);assert(r.state.foundRelics>s.foundRelics);assert(validRun(r.state));
});
test('Orbit: resonance rewards a three-cascade chain exactly once, preserves the charge cap and checkpoints',()=>{
 const s=createRun(2,1),r=act(s,{type:'swap',a:45,b:46});
 assert(r.ok);assert.deepEqual(r.frames.filter(f=>f.type==='clear').map(f=>f.combo),[1,2,3]);
 assert.equal(r.events.filter(e=>e.type==='resonance').length,1);
 const cleared=r.frames.filter(f=>f.type==='clear').reduce((n,f)=>n+f.cleared.length,0);
 assert.equal(r.state.energy,cleared+8);assert.equal(r.state.moves,s.moves-1);assert(validRun(r.state));
 const full=clone(s);full.energy=35;assert.equal(act(full,{type:'swap',a:45,b:46}).state.energy,CHARGE);
 const p=readProgress(null);p.unlocked=2;record(p,r.state);assert.deepEqual(readProgress(JSON.parse(JSON.stringify(p))).run,r.state);
 const short=act(createRun(2,1),{type:'swap',a:19,b:20});assert(short.ok);assert.equal(short.frames.filter(f=>f.type==='clear').length,2);assert(!short.events.some(e=>e.type==='resonance'));assert.equal(short.state.energy,6);
});
test('Orbit: footprints never wrap around board edges',()=>{const s=createRun();assert.deepEqual(footprint(s,0,'nova'),[0,1,8,9]);assert.deepEqual(footprint(s,7,'row'),[0,1,2,3,4,5,6,7]);});
test('Orbit: final move wins before loss; non-completed missions end on zero moves',()=>{
 let s=createRun(1,1);s.score=999;s.moves=1;let r=act(s,{type:'swap',a:hint(s)[0],b:hint(s)[1]});assert.equal(r.state.won,true);assert.equal(r.state.done,true);assert.equal(r.state.moves,0);assert.equal(stars(r.state),1);assert.equal(act(r.state,{type:'drill',index:0}).ok,false);
 s=createRun(24,3);s.moves=1;r=act(s,{type:'swap',a:hint(s)[0],b:hint(s)[1]});assert.equal(r.state.done,true);assert.equal(r.state.won,false);
});
test('Orbit: sector events trigger only on their cadence and preserve complete boards',()=>{
 let s=createRun(9,42);s.turn=4;let r=act(s,{type:'swap',a:hint(s)[0],b:hint(s)[1]});assert(r.events.some(e=>e.type==='meteor'));assert(validRun(r.state));
 s=createRun(18,42);s.turn=3;r=act(s,{type:'swap',a:hint(s)[0],b:hint(s)[1]});assert.equal(r.state.gravity,1);assert(r.events.some(e=>e.type==='gravity'));assert(validRun(r.state));
 s=createRun(18,42);s.turn=3;r=act(s,{type:'drill',index:0});assert.equal(r.state.gravity,0);assert.equal(r.state.turn,3);
});
test('Orbit: shuffle repairs a dead board while preserving special inventory and geological targets',()=>{
 const s=createRun(11,10);s.board.forEach((t,i)=>t.kind=(i%8+2*(i/8|0))%6);s.board[0].special='row';const before=clone(s.rocks),relics=clone(s.relics);ensureMoves(s);assert(hint(s));assert.equal(groups(s.board).length,0);assert.equal(s.board.filter(t=>t.special==='row').length,1);assert.deepEqual(s.rocks,before);assert.deepEqual(s.relics,relics);
});
test('Orbit: checkpoints survive reload; corrupted saves recover; legacy progress is retained',()=>{
 let p=readProgress(null,{level:7});assert.equal(p.unlocked,7);let s=createRun(1,7);s.score=999;let r=act(s,{type:'swap',a:hint(s)[0],b:hint(s)[1]});record(p,r.state);const saved=JSON.parse(JSON.stringify(p));assert.deepEqual(readProgress(saved).run,r.state);
 const best=p.stars[0];s=clone(r.state);s.moves=0;record(p,s);assert.equal(p.stars[0],best);assert.equal(p.unlocked,7);
 saved.run.board[0].kind=900;assert.equal(readProgress(saved).run,null);saved.run=null;saved.unlocked=Infinity;assert.equal(readProgress(saved).unlocked,1);
});
test('Orbit: repeated turns across every sector keep state serializable, stable and playable',()=>{
 for(const level of [1,4,8,9,11,16,17,18,24])for(let seed=1;seed<=6;seed++){
  let s=createRun(level,seed);for(let t=0;t<38&&!s.done;t++){
   const before=clone(s),moves=legalMoves(s),[a,b]=moves[t%moves.length];const r=s.energy===CHARGE?act(s,{type:'pulse',index:27}):act(s,{type:'swap',a,b});assert(r.ok);assert.deepEqual(s,before);s=r.state;assert(validRun(s),`level ${level}, seed ${seed}, turn ${t}`);assert.equal(groups(s.board).length,0);assert(hint(s));assert.equal(s.rocks.reduce((n,v)=>n+!!v,0)+s.clearedRocks,LEVELS[level-1].rocks);assert.equal(s.relics.filter(Boolean).length+s.foundRelics,LEVELS[level-1].relics);
  }
 }
});
