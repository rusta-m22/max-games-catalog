import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createRun,record,readProgress} from '../site/js/islands-engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const out=path.resolve('../deliverables');await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[];
try{for(const [name,id]of [['Ostrova_Kubikov_3D.html','islands'],['Sokrovishcha_Orbity_3D_v4.html','orbit']]){
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,hasTouch:true,isMobile:true,reducedMotion:'reduce'}),errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));await page.route('https://**/*',r=>{requests.push(r.request().url());return r.abort();});await page.route('http://**/*',r=>{requests.push(r.request().url());return r.abort();});await page.addInitScript(()=>localStorage.setItem('jarvis-sound','false'));
 await page.goto(pathToFileURL(path.join(out,name)).href);await page.waitForSelector(id==='islands'?'#isl-grid':'#orb-grid');const start=page.getByRole('button',{name:id==='islands'?'На остров!':'Начать миссию',exact:true});if(await start.isVisible())await start.click();
 assert.equal(await page.locator('[role=gridcell]').count(),64);assert.equal(await page.locator('[data-renderer]').getAttribute('data-renderer'),'webgl');
 if(id==='islands'){await page.locator('[data-slot="0"]').click();await page.locator('[data-cell="0"]').click();await page.waitForFunction(()=>document.querySelector('#isl-grid').getAttribute('aria-busy')==='false');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('jarvis-islands-v1')).classic.turn),1);const p=readProgress(null);p.seen=true;p.stars.fill(3);p.unlocked=18;record(p,createRun('journey',8,52));await page.evaluate(p=>localStorage.setItem('jarvis-islands-v1',JSON.stringify(p)),p);await page.reload();await page.waitForSelector('#isl-grid');}else{await page.locator('#orb-hint').click();assert.equal(await page.locator('.orb-cell.hint').count(),2);}
 await page.waitForTimeout(500);await page.screenshot({path:path.join(out,id==='islands'?'Ostrova_Kubikov_3D_Preview.png':'Sokrovishcha_Orbity_3D_v4_Preview.png')});
 for(const [width,height]of [[320,568],[844,390],[1366,768]]){await page.setViewportSize({width,height});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&document.documentElement.scrollHeight<=innerHeight));}
 assert.equal(errors.length,0,errors.join('\n'));assert.equal(requests.length,0,requests.join('\n'));results.push({file:name,offline:true,errors,externalRequests:requests,viewports:4});await page.close();
}await writeFile(path.resolve('../qa/offline-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));}finally{await browser.close();}
