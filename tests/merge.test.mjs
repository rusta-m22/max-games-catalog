import test from 'node:test';
import assert from 'node:assert/strict';
import {FIELD,createGame,restoreGame,copyGame,makeBody,launch,stepGame,revive,contact} from '../site/js/merge-engine.js';
const sum=s=>s.bodies.reduce((v,b)=>v+b.value,0);
function settle(s){const events=[];for(let i=0;i<1800&&s.phase==='flying';i++)events.push(...stepGame(s));assert.notEqual(s.phase,'flying','shot must settle within 15 simulated seconds');return events;}
function empty(){const s=createGame(71);s.bodies=[];return s;}

test('merge3d: a launch crosses the warning line without an early loss',()=>{
 const s=empty();assert(launch(s,0));for(let i=0;i<10;i++)stepGame(s);assert.equal(s.phase,'flying');assert(s.bodies[0].z>FIELD.line);settle(s);assert.equal(s.phase,'ready');assert.equal(sum(s),2);
});
test('merge3d: equal cubes merge on contact and chain, conserving their value',()=>{
 const s=createGame(123),initial=sum(s);assert(launch(s,1.9));const events=settle(s),merges=events.filter(e=>e.type==='merge');assert.deepEqual(merges.map(e=>e.value),[4,8]);assert.equal(s.combo,2);assert.equal(s.score,12);assert.equal(sum(s),initial+2);assert.equal(s.bodies.length,7);
});
test('merge3d: unequal values collide, transfer momentum and never merge',()=>{
 const s=empty();s.bodies.push(makeBody(s,16,0,-3));assert(launch(s,0));const events=settle(s);assert.equal(events.filter(e=>e.type==='merge').length,0);assert.equal(sum(s),18);assert.equal(s.bodies.length,2);assert(s.bodies.find(b=>b.value===16).z<-3);
});
test('merge3d: vertical separation prevents a mid-air phantom merge',()=>{
 const s=empty(),a=makeBody(s,2,0,0),b=makeBody(s,2,0,0,{y:2});assert.equal(contact(a,b),null);s.bodies=[a,b];s.phase='flying';const events=settle(s);assert.equal(sum(s),4);assert.equal(events.filter(e=>e.type==='merge').length,1);
});
test('merge3d: only settled cubes over the line finish a round',()=>{
 const s=empty();s.bodies.push(makeBody(s,8,0,FIELD.line+.2));s.phase='flying';for(let i=0;i<30;i++)stepGame(s);assert.equal(s.phase,'flying');const events=settle(s);assert.equal(s.phase,'over');assert.equal(events.filter(e=>e.type==='over').length,1);assert.deepEqual(stepGame(s),[]);
});
test('merge3d: a busy or finished game rejects extra shots and bonus spending',()=>{
 const s=createGame(123);assert(launch(s,0,'bomb'));const before=copyGame(s);assert.equal(launch(s,1,'wild'),false);assert.deepEqual(s,before);s.phase='over';assert.equal(launch(s,0),false);
});
test('merge3d: bomb clears its impact area, spends once and preserves the queue',()=>{
 const s=createGame(123),queue=[...s.queue];assert(launch(s,0,'bomb'));assert.equal(s.bombs,1);const events=settle(s);assert.equal(events.filter(e=>e.type==='blast').length,1);assert(s.bodies.length<8);assert.deepEqual(s.queue,queue);assert(!s.bodies.some(b=>b.kind==='bomb'));assert.equal(s.score,0);
});
test('merge3d: wild doubles the first contacted number, without consuming the queue',()=>{
 const s=empty();s.bodies.push(makeBody(s,64,0,-3));const queue=[...s.queue];assert(launch(s,0,'wild'));const events=settle(s);assert.equal(s.wilds,0);assert(events.some(e=>e.type==='merge'&&e.value===128));assert.equal(sum(s),128);assert.deepEqual(s.queue,queue);assert(!s.bodies.some(b=>b.kind==='wild'));
});
test('merge3d: milestone gives one bomb and continues after 2048',()=>{
 const s=empty();s.queue=[1024,2,4];s.maxValue=1024;s.earnedMilestone=1024;s.bombs=0;s.bodies.push(makeBody(s,1024,0,-3));launch(s,0);const events=settle(s);assert.equal(s.maxValue,2048);assert.equal(s.bombs,1);assert.equal(events.filter(e=>e.type==='milestone').length,1);assert.equal(s.phase,'ready');
});
test('merge3d: mid-flight save restores the same outcome and random queue',()=>{
 const s=createGame(234);launch(s,1.9);for(let i=0;i<65;i++)stepGame(s);const restored=restoreGame(JSON.parse(JSON.stringify(s)));assert(restored);settle(s);settle(restored);assert.deepEqual(restored,s);
});
test('merge3d: undo snapshot restores spent boosts and the entire turn',()=>{
 const s=createGame(123),before=copyGame(s);launch(s,0,'bomb');settle(s);const restored=restoreGame(before);assert.equal(restored.bombs,2);assert.equal(restored.moves,0);assert.equal(restored.bodies.length,8);assert.deepEqual(restored.queue,[2,4,8]);
});
test('merge3d: corrupt or incompatible saved games are rejected',()=>{
 assert.equal(restoreGame({board:Array(30).fill(0)}),null);for(const change of [s=>s.bodies.push(s.bodies[0]),s=>s.bodies[0].x=Infinity,s=>s.queue=[3,2,4],s=>s.nextId=1,s=>s.bodies[0].value=3,s=>s.bodies[0].y=99]){const s=createGame(14);change(s);assert.equal(restoreGame(s),null);}assert(restoreGame(createGame(14)));
});
test('merge3d: revive is limited to one and clears the warning zone',()=>{
 const s=empty();s.bodies.push(makeBody(s,8,0,6));s.phase='over';assert(revive(s));settle(s);assert.equal(s.phase,'ready');s.phase='over';assert.equal(revive(s),false);
});
test('merge3d: 25 seeded games keep finite positions, mass balance, and bounded rounds',()=>{
 for(let seed=1;seed<=25;seed++){
  const s=createGame(seed);let expected=sum(s),n=0;
  while(s.phase==='ready'&&n++<120){const x=Math.sin(seed*8.91+n*3.77)*3;expected+=s.queue[0];assert(launch(s,x));settle(s);assert.equal(sum(s),expected);assert(restoreGame(s));for(const b of s.bodies){assert(b.x>=-FIELD.halfWidth&&b.x<=FIELD.halfWidth);assert(b.y>=FIELD.half-.005);assert(b.z>=FIELD.back&&b.z<=FIELD.front);}}
  assert(n>5,'a fresh game must support more than a handful of throws');
 }
});
