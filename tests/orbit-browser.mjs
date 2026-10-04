// Browser QA uses intercepted local files, without touching the published site.
import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createRun,readProgress,record,hint,act} from '../site/js/orbit-engine.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(fileURLToPath(new URL('../site/',import.meta.url))),out=process.env.QA_OUTPUT||'/tmp/orbit-qa';await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const errors=[],results=[],KEY='jarvis-orbit-expedition-v2';
const check=(name,ok=true)=>{assert(ok,name);results.push(name);console.log('PASS:',name);};
async function pageFor(state=createRun(11,47),viewport={width:1440,height:1000},options={}){
 const page=await browser.newPage({viewport,deviceScaleFactor:1,hasTouch:!!options.touch,isMobile:!!options.touch,reducedMotion:options.reduced?'reduce':'no-preference'});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async r=>{const u=new URL(r.request().url());if(u.hostname!=='orbit.test')return r.abort();const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root+path.sep))return r.abort();try{await r.fulfill({body:await readFile(f),contentType:({'.html':'text/html','.js':'text/javascript','.css':'text/css','.ttf':'font/ttf','.svg':'image/svg+xml'})[path.extname(f)]||'application/octet-stream'});}catch{await r.fulfill({status:404,body:'Not found'});}});
 const p=readProgress(null);p.unlocked=state.level;record(p,state);
 await page.addInitScript(({p,options})=>{if(!sessionStorage.getItem('orbit-qa')){localStorage.setItem('jarvis-orbit-expedition-v2',JSON.stringify(options.corrupt?{...p,run:{bad:true}}:p));localStorage.setItem('jarvis-sound','false');sessionStorage.setItem('orbit-qa','1');}if(options.fallback){const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type.includes('webgl')?null:original.call(this,type,...args);};}},{p,options});
 await page.goto('https://orbit.test/play.html?game=orbit');await page.waitForSelector('#orb-grid');await page.waitForFunction(()=>document.querySelector('#orb-board')?.dataset.renderer);
 const start=page.getByRole('button',{name:'Начать миссию',exact:true});if(await start.isVisible())await start.click();return page;
}
const read=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),KEY);
const ready=page=>page.waitForFunction(()=>document.querySelector('#orb-grid')?.getAttribute('aria-busy')==='false',null,{timeout:20000});
async function swap(page,a,b){await page.locator(`[data-index="${a}"]`).click();await page.locator(`[data-index="${b}"]`).click();await ready(page);}
async function closeDialog(page){if(await page.locator('#modal').isVisible())await page.getByRole('button',{name:'Закрыть',exact:true}).click();}
async function horizontalFit(page){return page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1);}
try{
 const desk=await pageFor();check('3D renders with WebGL',await desk.getAttribute('#orb-board','data-renderer')==='webgl');check('Mission objectives and 64 accessible cells exist',await desk.locator('[role="gridcell"]').count()===64&&await desk.locator('#orb-goals .orb-goal').count()===2);
 check('Perspective narrows the far row',await desk.locator('[data-index="0"]').evaluate(e=>e.getBoundingClientRect().width<document.querySelector('[data-index="56"]').getBoundingClientRect().width));
 check('Every projected cell receives taps at its visible center',await desk.locator('.orb-cell').evaluateAll(cells=>cells.every(e=>{const r=e.getBoundingClientRect();return document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('.orb-cell')===e;})));
 await desk.screenshot({path:path.join(out,'orbit-desktop.png'),fullPage:true});
 let s=(await read(desk)).run,[a,b]=hint(s),before=s.moves;await swap(desk,a,b);s=(await read(desk)).run;check('Two clicks perform exactly one valid exchange',s.moves===before-1&&s.score>0);
 const frozen=JSON.stringify(await read(desk));await desk.reload();await desk.waitForSelector('#orb-grid');check('Reload restores the committed board and progress',JSON.stringify(await read(desk))===frozen);
 await desk.locator('#orb-hint').click();check('Hint highlights a playable pair',await desk.locator('.orb-cell.hint').count()===2);
 s=(await read(desk)).run;let invalid=null;outer:for(let i=0;i<56;i++)if(!act(s,{type:'swap',a:i,b:i+8}).ok){invalid=[i,i+8];break outer;}
 await swap(desk,...invalid);check('Rejected exchange does not spend a move',(await read(desk)).run.moves===s.moves);
 await desk.locator('#orb-rules').click();check('Rules explain combinations and gravity',(await desk.locator('#modal').innerText()).includes('направление дальнейшего падения'));check('Rules pause the game',await desk.locator('#modal').isVisible());await closeDialog(desk);
 await desk.locator('#orb-map').click();check('Map has three sectors and eight missions at a time',await desk.locator('.orb-map-tabs button').count()===3&&await desk.locator('.orb-node').count()===8);await desk.locator('[data-sector="2"]').click();check('Future missions are locked',await desk.locator('.orb-node:disabled').count()===8);await desk.screenshot({path:path.join(out,'orbit-map.png')});await closeDialog(desk);
 s=(await read(desk)).run;await desk.locator('#orb-drill').click();let rock=s.rocks.findIndex(v=>v>0);await desk.locator(`[data-index="${rock}"]`).click();await ready(desk);check('Drill hits the target and spends one tool, zero moves',(await read(desk)).run.drills===s.drills-1&&(await read(desk)).run.moves===s.moves&&(await read(desk)).run.rocks[rock]===0);
 await desk.locator('#orb-map').click();await desk.getByRole('button',{name:'Повторить текущую',exact:true}).click();await desk.getByRole('button',{name:'Начать заново',exact:true}).click();await desk.getByRole('button',{name:'Начать миссию',exact:true}).click();check('Retry resets only the attempt',(await read(desk)).run.drills===2&&(await read(desk)).run.turn===0&&(await read(desk)).unlocked===11);
 await desk.close();

 let energy=createRun(18,81);energy.energy=36;energy.turn=3;const pulse=await pageFor(energy,undefined,{reduced:true});let saved=(await read(pulse)).run;await pulse.locator('#orb-pulse').click();await pulse.locator('[data-index="27"]').click();await ready(pulse);check('Charged impulse works without spending a turn',(await read(pulse)).run.moves===saved.moves&&(await read(pulse)).run.energy<=36);
 s=(await read(pulse)).run;[a,b]=hint(s);await swap(pulse,a,b);check('Fourth move rotates the next fall direction',(await read(pulse)).run.gravity===1);await pulse.close();

 const resonance=await pageFor(createRun(2,1),{width:390,height:844},{reduced:true});await swap(resonance,45,46);check('Three cascades award and display resonance', (await read(resonance)).run.energy===18&&(await resonance.locator('#orb-event').innerText()).includes('Резонанс'));await resonance.reload();await resonance.waitForSelector('#orb-grid');check('Resonance charge survives reload',(await read(resonance)).run.energy===18);await resonance.close();

 const phone=await pageFor(createRun(4,444),{width:390,height:844},{touch:true});check('Phone has no horizontal overflow',await horizontalFit(phone));check('Phone boosters fit on screen',await phone.locator('#orb-hint').evaluate(e=>e.getBoundingClientRect().bottom<=innerHeight));await phone.screenshot({path:path.join(out,'orbit-mobile.png'),fullPage:true});
 s=(await read(phone)).run;[a,b]=hint(s);const ba=await phone.locator(`[data-index="${a}"]`).boundingBox(),bb=await phone.locator(`[data-index="${b}"]`).boundingBox(),cdp=await phone.context().newCDPSession(phone);const p1={x:ba.x+ba.width/2,y:ba.y+ba.height/2},p2={x:bb.x+bb.width/2,y:bb.y+bb.height/2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p2]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});check('Cancelled swipe consumes no move',(await read(phone)).run.moves===s.moves);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[p1]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[p2]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await ready(phone);check('Real touch swipe exchanges adjacent gems once',(await read(phone)).run.moves===s.moves-1);
 for(const viewport of [{width:320,height:640},{width:360,height:640},{width:844,height:390}]){await phone.setViewportSize(viewport);check(`Responsive layout ${viewport.width}×${viewport.height}`,await horizontalFit(phone));}await phone.close();

 const fallback=await pageFor(createRun(11,55),{width:390,height:844},{fallback:true,reduced:true});check('Playable canvas fallback when WebGL is unavailable',await fallback.getAttribute('#orb-board','data-renderer')==='canvas');s=(await read(fallback)).run;[a,b]=hint(s);await fallback.locator(`[data-index="${a}"]`).focus();await fallback.keyboard.press('Enter');await fallback.locator(`[data-index="${b}"]`).focus();await fallback.keyboard.press('Enter');await ready(fallback);check('Keyboard can select and exchange crystals',(await read(fallback)).run.moves===s.moves-1);await fallback.screenshot({path:path.join(out,'orbit-canvas-fallback.png')});await fallback.close();

 const win=createRun(1,51);win.score=999;win.moves=1;const end=await pageFor(win,undefined,{reduced:true});[a,b]=hint(win);await swap(end,a,b);await end.waitForSelector('#modal[open]');let p=await read(end);check('Win on the last move opens the next mission',p.run.won&&p.unlocked===2&&p.stars[0]===1);await end.screenshot({path:path.join(out,'orbit-victory.png')});await end.getByRole('button',{name:'Следующая миссия',exact:true}).click();await end.getByRole('button',{name:'Начать миссию',exact:true}).click();check('Next mission starts with new goals and fresh tools',(await read(end)).run.level===2&&(await read(end)).run.drills===2);await end.close();

 const defeat=createRun(24,79);defeat.moves=1;const loss=await pageFor(defeat,undefined,{reduced:true});[a,b]=hint(defeat);await swap(loss,a,b);await loss.waitForSelector('#modal[open]');check('Loss offers a working retry',await loss.getByRole('button',{name:'Попробовать ещё',exact:true}).isVisible());await loss.getByRole('button',{name:'Попробовать ещё',exact:true}).click();await loss.getByRole('button',{name:'Начать миссию',exact:true}).click();check('Retry after loss restores all moves',(await read(loss)).run.moves===34);await loss.close();
 const corrupt=await pageFor(createRun(3,99),undefined,{corrupt:true});check('Damaged save recovers to a new playable mission',(await read(corrupt)).run.board.length===64);await corrupt.close();
 check('No unhandled JavaScript errors',errors.length===0);await writeFile(path.join(out,'browser-results.json'),JSON.stringify({passed:results.length,checks:results,errors},null,2));
}finally{await browser.close();}
