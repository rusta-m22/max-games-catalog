const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {createRun as islandRun,readProgress as islandProgress,record as islandRecord} from '../site/js/islands-engine.js';
const root=path.resolve('site'),out=path.resolve('../qa');await mkdir(out,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const [game,w,h]of [['islands',390,844],['islands',1366,768],['orbit',390,844],['orbit',1366,768]]){
 const page=await browser.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='games.test')return r.abort();try{const f=path.resolve(root,'.'+u.pathname);await r.fulfill({body:await readFile(f),contentType:({'.js':'text/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream'});}catch{await r.fulfill({status:404,body:'Not found'});}});
 const p=islandProgress(null);p.stars.fill(3);p.unlocked=18;p.seen=true;islandRecord(p,islandRun('journey',8,52));await page.addInitScript(p=>{localStorage.setItem('jarvis-islands-v1',JSON.stringify(p));localStorage.setItem('jarvis-sound','false');},p);
 await page.goto(`https://games.test/play.html?game=${game}`);await page.waitForSelector(game==='orbit'?'#orb-grid':'#isl-grid');if(game==='orbit')await page.getByRole('button',{name:'Начать миссию',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[data-renderer]'));
 await page.waitForTimeout(500);await page.screenshot({path:path.join(out,`${game}-${w}.png`)});
 results.push({game,w,h,errors,layout:await page.evaluate(()=>({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,main:document.querySelector('#game').getBoundingClientRect().toJSON(),targets:[...document.querySelectorAll('[role=gridcell]')].every(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('[role=gridcell]')===e;})}))});await page.close();
}await writeFile(path.join(out,'screen-review.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));}finally{await browser.close();}
