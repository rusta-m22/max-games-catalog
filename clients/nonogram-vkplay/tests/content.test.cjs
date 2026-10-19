'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const globals={console,Date,Math};globals.window=globals;
const context=vm.createContext(globals);
for(const filename of ['content.js','extra-content.js','core.js'])
  vm.runInContext(fs.readFileSync(path.join(root,'game',filename),'utf8'),context);
const data=context.window.NONO_DATA,core=context.window.NonoCore;
test('All 507 puzzles retain valid grids, clues and unique IDs',()=>{
  assert.equal(data.levels.length,507);assert.equal(data.worlds.length,10);
  assert.equal(new Set(data.levels.map(p=>p.id)).size,data.levels.length);
  for(const p of data.levels) {
    const q=core.prepare(p);assert.equal(q.grid.length,p.n*p.n,p.id);
    for(const v of q.grid)assert(Number.isInteger(v)&&v>=0&&v<10,p.id);
    assert.equal(q.rows.length,p.n,p.id);assert.equal(q.cols.length,p.n,p.id);
    for(const [index,value]of p.givens)assert.equal(Number(q.grid[index]),value,p.id);
  }
});
test('Client and server puzzle solutions and shop costs agree',()=>{
  const server=JSON.parse(fs.readFileSync(path.join(root,'server/content.json')));
  for(const p of data.levels){const s=server.levels.find(s=>s.id===p.id);assert(s,p.id);assert.equal(s.grid,p.grid,p.id);}
  vm.runInContext(fs.readFileSync(path.join(root,'game/economy-data.js'),'utf8'),context);
  const catalog=JSON.parse(fs.readFileSync(path.join(root,'server/catalog.json')));
  assert.equal(JSON.stringify(context.window.ECONOMY_DATA.items),JSON.stringify(catalog.items));
});
