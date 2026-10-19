/* Pure puzzle rules and linear-time-per-state constraint propagation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.NonoCore=api;})(globalThis,()=>{
'use strict';
function clues(line){const out=[];for(const c of line){if(!c)continueRun();else if(out.length&&active===c){out[out.length-1][0]++;}else{out.push([1,c]);active=c;}}return out;function continueRun(){active=0;}var active;}
// A deterministic automaton for each clue sequence; different colours may touch.
function automaton(runs){const edges=[[]];let s=0;edges[0].push([0,0]);runs.forEach(([len,col],i)=>{for(let j=0;j<len;j++){edges[s].push([col,edges.length]);s=edges.length;edges.push([]);}if(i<runs.length-1&&col===runs[i+1][1]){edges[s].push([0,edges.length]);s=edges.length;edges.push([]);}edges[s].push([0,s]);});return {edges,accept:s};}
function lineSupport(dom,dfa){const n=dom.length,m=dfa.edges.length,F=Array.from({length:n+1},()=>new Uint8Array(m));F[0][0]=1;for(let p=0;p<n;p++)for(let s=0;s<m;s++)if(F[p][s])for(const [c,t] of dfa.edges[s])if(dom[p]&(1<<c))F[p+1][t]=1;
 if(!F[n][dfa.accept])return null;let back=new Uint8Array(m);back[dfa.accept]=1;const supported=new Uint16Array(n);for(let p=n-1;p>=0;p--){const prev=new Uint8Array(m);for(let s=0;s<m;s++)for(const [c,t]of dfa.edges[s])if(back[t]&&(dom[p]&(1<<c))){prev[s]=1;if(F[p][s])supported[p]|=1<<c;}back=prev;}return supported;}
function prepare(p){const n=p.n,grid=Array.from(p.grid,Number),rows=[],cols=[];for(let y=0;y<n;y++)rows.push(clues(grid.slice(y*n,(y+1)*n)));for(let x=0;x<n;x++)cols.push(clues(Array.from({length:n},(_,y)=>grid[y*n+x])));return {n,grid,rows,cols,dfa:[...rows,...cols].map(automaton),mask:grid.reduce((a,v)=>a|(1<<v),1)};}
function propagate(p,dom,dirty){const n=p.n,queue=dirty?dirty.slice():Array.from({length:n*2},(_,i)=>i),queued=new Set(queue);let head=0;while(head<queue.length){const li=queue[head++];queued.delete(li);const ids=Array.from({length:n},(_,i)=>li<n?li*n+i:i*n+li-n);const out=lineSupport(ids.map(i=>dom[i]),p.dfa[li]);if(!out)return false;for(let j=0;j<n;j++){const id=ids[j],v=dom[id]&out[j];if(!v)return false;if(v!==dom[id]){dom[id]=v;const other=li<n?n+j:j;if(!queued.has(other)){queued.add(other);queue.push(other);}}}}return true;}
function domains(p,givens=[]){const d=new Uint16Array(p.n*p.n).fill(p.mask);for(const [i,v] of givens)d[i]=1<<v;return d;}
function fixed(v){return v>0&&(v&(v-1))===0;}
function hash(str){let h=2166136261;for(const c of str){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
function worldDone(state,w,levels){return levels.filter(p=>p.world===w&&p.type!=='mega').every(p=>state.done[p.id]);}
function worldOpen(state,w){return w===0||!!state.done['w'+w+'-30'];}
function levelOpen(state,p){if(p.type==='mega')return true;if(!worldOpen(state,p.world))return false;const prefix='w'+(p.world+1)+'-';if(p.index<24)return p.index===0||!!state.done[prefix+p.index];const normal=Array.from({length:24},(_,i)=>state.done[prefix+(i+1)]).filter(Boolean).length;if(p.type==='secret')return normal>=6+(p.index-24)*6;return normal===24;}
return {clues,automaton,lineSupport,prepare,propagate,domains,fixed,hash,worldDone,worldOpen,levelOpen};
});
