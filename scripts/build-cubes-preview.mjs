// Single-file playable preview, built from the same source that the catalog loads.
import {build} from 'vite';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url)),target=path.resolve(process.argv[2]||path.join(root,'../deliverables/Kubomaniya_Mechta_Madzhong.html')),temp=await mkdtemp(path.join(os.tmpdir(),'cubes-preview-'));
try{
 const entry=path.join(temp,'entry.js');await writeFile(entry,`import {start} from ${JSON.stringify(path.join(root,'site/js/cubes.js'))};window.JarvisAdsReady=Promise.resolve({info:()=>({capabilities:{rewarded:false}}),afterRound:async()=>({shown:false,rewarded:false,reason:'offline'}),rewarded:async()=>({shown:false,rewarded:false,reason:'offline'})});start('cubes',document.querySelector('#game'));document.querySelector('.cb-head a').onclick=e=>{e.preventDefault();document.querySelector('#cb-menu').click();};`);
 const result=await build({configFile:false,root,logLevel:'warn',define:{'import.meta.url':'document.baseURI'},build:{write:false,target:'es2022',minify:true,lib:{entry,name:'DreamMahjong',formats:['iife']},emptyOutDir:false}}),chunk=(Array.isArray(result)?result:[result]).flatMap(r=>r.output).find(o=>o.type==='chunk'&&o.isEntry);if(!chunk)throw Error('No game bundle');
 const css=(await readFile(path.join(root,'site/style.css'),'utf8')).replace(/@font-face\{[^}]+\}/g,'')+'\n'+await readFile(path.join(root,'site/cubes.css'),'utf8'),license=(await readFile(path.join(root,'site/vendor/THREE-LICENSE.txt'),'utf8')).replace(/--/g,'—');
 const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><!-- Three.js: ${license} --><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#8472b5"><title>Кубомания: мечта маджонг</title><style data-cubes-style>${css}</style></head><body class="play-page"><main id="game" class="game-root"></main><div id="toast" role="status" aria-live="polite"></div><dialog id="modal"></dialog><script>${chunk.code.replace(/<\/script/gi,'<\\/script')}</script></body></html>`;await mkdir(path.dirname(target),{recursive:true});await writeFile(target,html);console.log(`Standalone: ${target} (${Buffer.byteLength(html)} bytes)`);
}finally{await rm(temp,{recursive:true,force:true});}
