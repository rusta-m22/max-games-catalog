import {readFile,readdir,access} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {games} from '../site/js/data.js';
import {server} from '../serve.mjs';
const root=fileURLToPath(new URL('../site/',import.meta.url));
async function walk(dir){const out=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);out.push(...(e.isDirectory()?await walk(p):[p]));}return out;}
const files=await walk(root),errors=[];let checked=0;
async function reference(file,url){if(!url||/^(?:data:|https?:|mailto:|tel:|#|javascript:|blob:)/.test(url)||url.includes('${'))return;try{const target=url.startsWith('/')?path.join(root,url):fileURLToPath(new URL(url,pathToFileURL(file)));await access(target);checked++;}catch{errors.push(path.relative(root,file)+' → '+url);}}
for(const file of files){if(!/\.(html|css|js)$/.test(file))continue;const text=await readFile(file,'utf8');if(file.endsWith('.html')){const dom=new JSDOM(text);for(const el of dom.window.document.querySelectorAll('[src],link[href],a[href]'))await reference(file,el.getAttribute('src')||el.getAttribute('href'));dom.window.close();}else if(file.endsWith('.css')){for(const m of text.matchAll(/url\(\s*['"]?([^'"\)]+)['"]?\s*\)/g))await reference(file,m[1].trim());}else{for(const m of text.matchAll(/(?:import|export)\s[^;\n]*?from\s*['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g)){const url=m[1]||m[2];if(url.startsWith('.'))await reference(file,url);}}}
assert.equal(games.length,18);assert.equal(new Set(games.map(g=>g.id)).size,18);assert(!games.some(g=>g.id==='memasiki'));for(const g of games.filter(g=>g.legacy))await access(path.join(root,'games',g.id,'index.html'));
if(errors.length)throw Error(errors.join('\n'));
server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
try{for(const [url,mime] of [['/','text/html'],['/play.html?game=chess','text/html'],['/shared/ads/v1/index.js','text/javascript'],['/games/bumbila/index.wasm','application/wasm']]){const res=await fetch(origin+url,{method:'HEAD'});assert.equal(res.status,200);assert(res.headers.get('content-type').startsWith(mime));}
 const manifest=await fetch(origin+'/shared/ads/manifest.json');assert.equal(manifest.headers.get('access-control-allow-origin'),'*');assert.equal((await manifest.json()).apiVersion,1);
 assert.equal((await fetch(origin+'/package.json')).status,404);assert.equal((await fetch(origin+'/missing.wasm')).status,404);
}finally{server.close();server.closeAllConnections();await once(server,'close');}
console.log(`PASS: ${files.length} site files; ${checked} local references; 18 catalog entries; HTTP, MIME, CORS and 404 behavior`);
