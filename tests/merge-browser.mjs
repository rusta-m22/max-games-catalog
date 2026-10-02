// Optional real-browser QA. Set PLAYWRIGHT_MODULE / CHROMIUM_PATH if not installed globally.
import assert from 'node:assert/strict';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {once} from 'node:events';
import {server} from '../serve.mjs';
import {createGame,makeBody} from '../site/js/merge-engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const output=process.env.QA_OUTPUT||'/tmp/merge-qa';await mkdir(output,{recursive:true});
server.listen(0,'127.0.0.1');await once(server,'listening');const origin=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const results=[],errors=[];
const check=(name,ok=true)=>{assert(ok,name);results.push(name);console.log('PASS:',name);};
async function createPage(viewport={width:1365,height:880},state=createGame(123),touch=false){
 const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:touch,isMobile:touch});page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://**/*',r=>r.abort());
 await page.addInitScript(s=>{if(!sessionStorage.getItem('qa-started')){localStorage.setItem('jarvis-merge-3d',JSON.stringify({state:s,undo:null}));localStorage.setItem('jarvis-sound','false');sessionStorage.setItem('qa-started','1');}},state);
 await page.goto(origin+'/play.html?game=merge',{waitUntil:'domcontentloaded'});await page.waitForSelector('.merge-canvas');await page.waitForFunction(()=>document.querySelector('.merge-arena').dataset.renderer);await page.waitForTimeout(150);return page;
}
const read=page=>page.evaluate(()=>JSON.parse(localStorage.getItem('jarvis-merge-3d')));
const ready=page=>page.waitForFunction(()=>JSON.parse(localStorage.getItem('jarvis-merge-3d')).state.phase==='ready',null,{timeout:20000});
async function keyShot(page,steps=0){await page.locator('.merge-canvas').focus();for(let i=0;i<Math.abs(steps);i++)await page.keyboard.press(steps>0?'ArrowRight':'ArrowLeft');await page.keyboard.press('Space');}
async function fits(page){return page.evaluate(()=>{const buttons=[...document.querySelectorAll('.merge-tools button,.merge-boosters button')];return document.documentElement.scrollWidth<=innerWidth+1&&document.body.scrollHeight<=innerHeight+1&&buttons.every(b=>{const r=b.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1;});});}
try{
 const desktop=await createPage();check('Actual WebGL renderer starts',await desktop.getAttribute('.merge-arena','data-renderer')==='webgl');check('Desktop controls fit the viewport',await fits(desktop));
 await desktop.screenshot({path:path.join(output,'merge-desktop.png')});
 await keyShot(desktop,8);await ready(desktop);let saved=await read(desktop);check('Keyboard aim and launch produce the 2 → 4 → 8 combo',saved.state.score===12&&saved.state.combo===2&&saved.state.moves===1);
 await desktop.screenshot({path:path.join(output,'merge-desktop-combo.png')});
 const board=saved.state.bodies.map(b=>[b.value,b.x,b.y,b.z]);await desktop.reload({waitUntil:'domcontentloaded'});await desktop.waitForSelector('.merge-canvas');saved=await read(desktop);check('Reload restores the board and the score',saved.state.score===12&&JSON.stringify(saved.state.bodies.map(b=>[b.value,b.x,b.y,b.z]))===JSON.stringify(board));
 await desktop.locator('#merge-undo').click();saved=await read(desktop);check('Undo restores the queue and the whole board',saved.state.score===0&&saved.state.bodies.length===8&&saved.state.queue.join(',')==='2,4,8'&&!saved.undo);check('Undo retains the personal best',await desktop.locator('#merge-best').textContent()==='12');
 await desktop.locator('#merge-bomb').click();await keyShot(desktop);await ready(desktop);saved=await read(desktop);check('Bomb launches, removes cubes and spends exactly one charge',saved.state.bombs===1&&saved.state.bodies.length<8&&saved.state.queue[0]===2);
 await desktop.locator('#merge-undo').click();check('Undo restores a spent booster',(await read(desktop)).state.bombs===2);
 await desktop.locator('#merge-wild').click();await keyShot(desktop);await ready(desktop);saved=await read(desktop);check('Wild cube merges and keeps the normal queue',saved.state.wilds===0&&saved.state.score>0&&saved.state.queue[0]===2);
 await desktop.locator('#merge-help').click();check('Rules open and explain bonuses',await desktop.locator('#modal').isVisible()&&(await desktop.locator('#modal').innerText()).includes('Радужный'));await desktop.locator('#modal button').click();
 await desktop.locator('#merge-new').click();await desktop.getByRole('button',{name:'Новая игра',exact:true}).last().click();check('New round resets boosts and board',(await read(desktop)).state.moves===0&&(await read(desktop)).state.bombs===2);
 await keyShot(desktop);await desktop.locator('#merge-pause').click();const paused=await read(desktop);await desktop.waitForTimeout(900);check('Pause freezes the simulation',JSON.stringify(await read(desktop))===JSON.stringify(paused));await desktop.locator('#modal button').click();await ready(desktop);
 const moves=(await read(desktop)).state.moves;await desktop.evaluate(()=>window.dispatchEvent(new Event('jarvis-ads-pause')));await keyShot(desktop);check('Advertising pause blocks launch',(await read(desktop)).state.moves===moves);await desktop.evaluate(()=>window.dispatchEvent(new Event('jarvis-ads-resume')));
 check('No rewarded offers are visible on a site without ads',await desktop.locator('#merge-rewards button:visible').count()===0);
 await desktop.close();

 const mobile=await createPage({width:390,height:844},createGame(231),true);check('Phone portrait layout fits without page scrolling',await fits(mobile));await mobile.screenshot({path:path.join(output,'merge-mobile.png')});
 const box=await mobile.locator('.merge-canvas').boundingBox(),x=box.x+box.width*.66,y=box.y+box.height*.74,cdp=await mobile.context().newCDPSession(mobile);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20,y:y-8}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await mobile.waitForTimeout(100);check('A cancelled touch gesture does not fire',(await read(mobile)).state.moves===0);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-15,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ready(mobile);check('Finger drag and release launches exactly one cube',(await read(mobile)).state.moves===1);
 await mobile.setViewportSize({width:360,height:640});await mobile.waitForTimeout(150);check('Small phone layout fits',await fits(mobile));await mobile.screenshot({path:path.join(output,'merge-small-phone.png')});
 await mobile.setViewportSize({width:844,height:390});await mobile.waitForTimeout(150);check('Phone landscape layout fits',await fits(mobile));await mobile.screenshot({path:path.join(output,'merge-landscape.png')});await mobile.close();

 const over=createGame(51);over.bodies=[makeBody(over,16,0,6)];over.phase='over';const end=await createPage(undefined,over);await end.waitForSelector('#modal[open]');check('A finished round can be restarted from its dialog',(await end.locator('#modal').innerText()).includes('Дорожка заполнена'));await end.getByRole('button',{name:'Новая игра',exact:true}).last().click();check('Restart after losing is playable',(await read(end)).state.phase==='ready');await end.close();
 check('No unhandled browser JavaScript errors',errors.length===0);
 await writeFile(path.join(output,'browser-results.json'),JSON.stringify({passed:results.length,checks:results,errors},null,2));
}finally{await browser.close();server.close();server.closeAllConnections();}
