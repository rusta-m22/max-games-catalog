// Self-contained HTML playtest built from the same source files as the MAX catalog.
import {build} from 'vite';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import os from 'node:os';
const root=fileURLToPath(new URL('../',import.meta.url));
const target=path.resolve(process.argv[2]||path.join(root,'../deliverables/Sokrovishcha_Orbity_3D_v4.html'));
const temp=await mkdtemp(path.join(os.tmpdir(),'orbit-preview-'));
try{
 const entry=path.join(temp,'entry.js');
 await writeFile(entry,`import {start} from ${JSON.stringify(path.join(root,'site/js/orbit.js'))};\nwindow.JarvisAdsReady=Promise.resolve({info:()=>({capabilities:{rewarded:false}}),afterRound:async()=>({shown:false,rewarded:false,reason:'offline'}),rewarded:async()=>({shown:false,rewarded:false,reason:'offline'})});\nstart(document.querySelector('#game'));document.querySelector('.orb-back').onclick=e=>{e.preventDefault();document.querySelector('#orb-map').click();};`);
 const result=await build({configFile:false,root,logLevel:'warn',define:{'import.meta.url':'document.baseURI'},build:{write:false,target:'es2022',minify:true,lib:{entry,name:'OrbitTreasures',formats:['iife']},emptyOutDir:false}});
 const chunk=(Array.isArray(result)?result:[result]).flatMap(r=>r.output).find(o=>o.type==='chunk'&&o.isEntry);
 if(!chunk)throw Error('No preview bundle emitted');
 const css=(await readFile(path.join(root,'site/style.css'),'utf8')).replace(/@font-face\{[^}]+\}/g,'')+'\n'+await readFile(path.join(root,'site/orbit.css'),'utf8');
 const code=chunk.code.replace(/<\/script/gi,'<\\/script');
 const license=(await readFile(path.join(root,'site/vendor/THREE-LICENSE.txt'),'utf8')).replace(/--/g,'—');
 const html=`<!doctype html><html lang="ru"><head><meta charset="utf-8"><!-- Three.js: ${license} --><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#192659"><title>Сокровища орбиты · 3D-экспедиция</title><style data-orbit-style>${css}</style></head><body class="play-page"><header class="play-header"><span class="back-link">3D-экспедиция</span><h1>Сокровища орбиты</h1><span class="brand-symbol" aria-hidden="true">✧</span></header><main id="game" class="game-root"></main><div id="toast" role="status" aria-live="polite"></div><dialog id="modal"></dialog><script>${code}</script></body></html>`;
 await mkdir(path.dirname(target),{recursive:true});await writeFile(target,html);console.log(`Standalone: ${target} (${Buffer.byteLength(html)} bytes)`);
}finally{await rm(temp,{recursive:true,force:true});}
