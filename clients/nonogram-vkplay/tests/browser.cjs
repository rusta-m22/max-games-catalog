// LOCAL: Chromium renderer + real local backend; native bridge and VK upstream emulated.
'use strict';
const {chromium}=require('playwright'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const {overlayUrl}=require('../desktop/platform-core.cjs'),paymentHosts=require('../desktop/config.json').paymentHosts;
const overlayConfig={releaseConfigured:true,backendUrl:'https://backend.example/',gcid:'0.2046788',paymentHosts};
async function until(page,fn,arg){const end=Date.now()+30000;while(Date.now()<end){if(await page.evaluate(fn,arg))return;await new Promise(r=>setTimeout(r,100));}throw new Error('Condition timed out: '+fn.toString());}
(async()=>{
 const fixture=spawn(process.platform==='win32'?'python':'python3',[path.join(__dirname,'local_fixture.py')],{stdio:['ignore','pipe','pipe']});
 const port=await new Promise((resolve,reject)=>{let buf='';fixture.stdout.on('data',x=>{buf+=x;if(buf.includes('\n'))resolve(JSON.parse(buf.split('\n')[0]).port);});fixture.on('error',reject);fixture.on('exit',c=>{if(c)reject(new Error('Fixture exited '+c));});});
 const base='http://127.0.0.1:'+port;let auth;
 async function api(route,payload,anon=false){const r=await fetch(base+route,{method:payload===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(!anon?{Authorization:'Bearer '+auth.token}:{})},body:payload===undefined?undefined:JSON.stringify(payload)}),v=await r.json();return r.ok?{ok:true,value:v}:{ok:false,status:r.status,error:v.error};}
 auth=(await api('/api/vkplay/auth',{uid:'42',otp:'browser-test-otp'},true)).value;
 const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname),p=path.resolve(root,'game','.'+rel);if(!p.startsWith(path.join(root,'game')+path.sep)){res.writeHead(403);return res.end();}try{res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.webp':'image/webp','.png':'image/png','.gif':'image/gif'})[path.extname(p)]||'application/octet-stream');res.end(fs.readFileSync(p));}catch(_){res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,args:['--no-sandbox']}),report={environment:'LOCAL; VK Play upstream and Native bridge EMULATED',checks:[],errors:[],passed:false};
 try{
  let mode='pending',lastOrder;const nativeCalls=[];const context=await browser.newContext({viewport:{width:1280,height:850},locale:'ru-RU'});
  async function checkoutMode(timeout){await fetch(base+'/test/checkout-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({timeout})});}
  async function confirm(product,orderId,tid=crypto.randomUUID()){const params={uid:'42',sum:'99.00',tid,merchant_param:JSON.stringify({uid:'42',item_id:product,additional_param:orderId})};params.sign=crypto.createHash('md5').update(Object.keys(params).sort().map(k=>k+'='+params[k]).join('')+'local-test-secret-not-a-credential').digest('hex');assert.equal((await (await fetch(base+'/api/vkplay/callback?'+new URLSearchParams(params))).json()).status,'ok');}
  await context.exposeBinding('testApi',(_s,p,v)=>api(p,v));
  await context.exposeBinding('testPurchase',async(_s,product,requestId)=>{nativeCalls.push({product,requestId});if(mode==='offline')return {ok:false,status:502,error:'NETWORK'};const r=await api('/api/vkplay/order',{product,requestId});if(!r.ok)return r;lastOrder=r.value;if(lastOrder.status!=='paid'){const overlay=new URL(overlayUrl(lastOrder.paymentUrl,overlayConfig));assert.equal(new URL(overlay.searchParams.get('url')).hostname,'co.vkpay.ru');}if(mode==='success'&&lastOrder.status!=='paid')await confirm(product,lastOrder.orderId);return {ok:true,value:{orderId:lastOrder.orderId,status:lastOrder.status}};});
  await context.addInitScript(({wallet,progress})=>{window.Native={bootstrap:()=>({ready:true,authorized:true,preview:false,userId:'42',locale:'ru-RU',wallet,state:JSON.parse(localStorage.getItem('test-save')||'null')||progress}),save:v=>{if(window.testSaveUnavailable)return false;localStorage.setItem('test-save',JSON.stringify(v));return true;},api:(p,v)=>window.testApi(p,v),purchase:(p,r)=>window.testPurchase(p,r)};},{wallet:auth.wallet,progress:auth.progress});
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await page.goto(`http://127.0.0.1:${server.address().port}/index.html`);await until(page,()=>window.Game?.board&&Platform.uiReady);await page.locator('#modal-root [data-action="close"]').first().click();
  const cells=await page.evaluate(()=>{const b=Game.board;return Array.from(b.q.grid,Number).map((v,i)=>({v,x:b.gx+(i%b.p.n+.5)*b.cell,y:b.gy+(Math.floor(i/b.p.n)+.5)*b.cell})).filter(x=>x.v>0);}),box=await page.locator('#board').boundingBox();for(const c of cells)await page.mouse.click(box.x+c.x,box.y+c.y);
  await until(page,()=>Game.board?.won&&Game.state.coins===155);await page.locator('[data-action="after-win"]').waitFor({state:'visible'});await page.screenshot({animations:'disabled',path:path.join(root,'evidence','victory.png')});report.checks.push('Puzzle solved by mouse; server reward +35; victory art visible');
  await page.locator('[data-action="after-win"]').click();await page.locator('.sidebar [data-target="shop"]').click();await until(page,()=>!document.querySelector('[data-action="eco-product"]').disabled);assert.equal(await page.locator('[data-action="eco-product"]').count(),5);assert.equal(await page.locator('[data-action="eco-ad"],[data-action="reward-hint"]').count(),0);report.checks.push('RU shop: five products, no advertising controls; simulated VK Pay URL passes actual native overlay URL builder');
  const before=(await api('/api/wallet')).value.wallet.coins;
  for(let i=1;i<=6;i++){await page.locator('[data-action="eco-product"][data-id="coins_500"]').click();await until(page,n=>Game.state.economy.pendingOrders.length===n,i);}
  assert.equal((await api('/api/wallet')).value.wallet.coins,before);report.checks.push('Six local checkout requests without callback grant zero coins');
  mode='success';await page.locator('[data-action="eco-product"][data-id="coins_500"]').click();await until(page,n=>Game.state.coins===n,before+500);await until(page,id=>!Game.state.economy.pendingOrders.includes(id),lastOrder.orderId);report.checks.push('Signed local callback grants exactly 500 and confirms amid pending orders');
  await page.screenshot({animations:'disabled',path:path.join(root,'evidence','shop.png')});await page.locator('[data-action="eco-buy"][data-id="hint_cell"]').click();await until(page,n=>Game.state.coins<n,before+500);const after=(await api('/api/wallet')).value.wallet;assert.equal(after.hintCredits.cell,4);report.checks.push('Hint purchase debits server wallet and adds one hint');
  await page.reload();await until(page,n=>window.Game?.state.coins===n&&Platform.uiReady,after.coins);assert.equal(await page.evaluate(()=>!!Game.state.done['w1-1']&&Game.state.hints===4),true);report.checks.push('Reload restores completion, balance and hint');
  // A real local backend order becomes uncertain; reload/cancel/balance checks
  // must not silently replace its id or erase gameplay state.
  await page.evaluate(()=>Game.navigate('shop'));await checkoutMode(true);mode='pending';
  const retryBefore=(await api('/api/wallet')).value.wallet.coins;
  const retryProduct=page.locator('[data-action="eco-product"][data-id="coins_1200"]');
  await retryProduct.click();await retryProduct.click();await page.locator('[data-action="eco-retry-checkout"]').waitFor();
  const oldRequest=await page.evaluate(()=>Game.state.economy.purchaseRequests.coins_1200),callsBeforeCheck=nativeCalls.length;
  await page.locator('[data-action="eco-check-payment"]').click();await until(page,()=>!document.querySelector('[data-action="eco-check-payment"]').disabled);
  assert.equal(nativeCalls.length,callsBeforeCheck);assert.equal(await page.evaluate(()=>Game.state.economy.purchaseRequests.coins_1200),oldRequest);
  await page.locator('#modal-root [data-action="close"]').first().click();await page.reload();await until(page,()=>window.Game&&Platform.uiReady);await page.evaluate(()=>Game.navigate('shop'));
  assert.equal(await page.evaluate(()=>Game.state.economy.purchaseRequests.coins_1200),oldRequest);assert(await page.evaluate(()=>!!Game.state.done['w1-1']&&Game.state.hints===4));
  report.checks.push('Uncertain checkout survives reload; cancel and balance refresh never create a new payment or erase progress');
  await page.locator('[data-action="eco-product"][data-id="coins_1200"]').click();await page.locator('[data-action="eco-retry-checkout"]').waitFor();
  mode='offline';const callsBeforeOffline=nativeCalls.length;await page.locator('[data-action="eco-retry-checkout"]').click();await until(page,()=>!document.querySelector('[data-action="eco-retry-checkout"]').disabled);
  assert.equal(nativeCalls.length,callsBeforeOffline+1);assert.equal(await page.evaluate(()=>Game.state.economy.purchaseRequests.coins_1200),oldRequest);mode='pending';
  report.checks.push('Network failure during explicit recheck keeps the original request and creates no new payment');
  await page.evaluate(()=>window.testSaveUnavailable=true);const callsBeforeStorage=nativeCalls.length;
  await page.locator('[data-action="eco-retry-checkout"]').click();await until(page,()=>!document.querySelector('[data-action="eco-retry-checkout"]').disabled);
  assert.equal(nativeCalls.length,callsBeforeStorage+1);assert.equal(await page.evaluate(()=>Game.state.economy.purchaseRequests.coins_1200),oldRequest);await page.evaluate(()=>window.testSaveUnavailable=false);
  report.checks.push('Failed durable save preserves the old checkout and prevents a new request');
  await checkoutMode(false);mode='success';const callsBeforeRetry=nativeCalls.length;
  await page.locator('[data-action="eco-retry-checkout"]').click();await until(page,n=>Game.state.coins===n,retryBefore+1200);
  assert.equal(nativeCalls.length,callsBeforeRetry+2);assert.equal(nativeCalls.at(-2).requestId,oldRequest);assert.notEqual(nativeCalls.at(-1).requestId,oldRequest);
  assert((await (await fetch(base+'/test/orders')).json()).orders.some(o=>o.request_id===oldRequest&&o.status==='unknown'));
  report.checks.push('Explicit retry checks old order first, creates a fresh request and credits only the signed new receipt; old order remains intact');
  await checkoutMode(true);mode='pending';await page.locator('[data-action="eco-product"][data-id="coins_3000"]').click();await page.locator('[data-action="eco-product"][data-id="coins_3000"]').click();await page.locator('[data-action="eco-retry-checkout"]').waitFor();
  const lateRequest=await page.evaluate(()=>Game.state.economy.purchaseRequests.coins_3000),lateOrder=(await (await fetch(base+'/test/orders')).json()).orders.find(o=>o.request_id===lateRequest);
  await confirm('coins_3000',lateOrder.id,'late-ui-transaction');await confirm('coins_3000',lateOrder.id,'late-ui-transaction');await checkoutMode(false);const callsBeforeLate=nativeCalls.length;
  await page.locator('[data-action="eco-retry-checkout"]').click();await until(page,n=>Game.state.coins===n,retryBefore+4200);assert.equal(nativeCalls.length,callsBeforeLate+1);
  report.checks.push('Late paid old order is recovered instead of creating another checkout; duplicate callback credits once');
  await checkoutMode(true);mode='pending';await page.locator('[data-action="eco-product"][data-id="starter"]').click();await page.locator('[data-action="eco-product"][data-id="starter"]').click();await page.locator('[data-action="eco-check-payment"]').waitFor();assert.equal(await page.locator('[data-action="eco-retry-checkout"]').count(),0);
  const starterRequest=await page.evaluate(()=>Game.state.economy.purchaseRequests.starter),callsBeforeStarter=nativeCalls.length;await page.locator('[data-action="eco-check-payment"]').click();await until(page,()=>!document.querySelector('[data-action="eco-check-payment"]').disabled);assert.equal(nativeCalls.length,callsBeforeStarter);assert.equal(await page.evaluate(()=>Game.state.economy.purchaseRequests.starter),starterRequest);await page.locator('#modal-root [data-action="close"]').first().click();
  report.checks.push('Uncertain one-time starter never offers a second checkout; balance refresh keeps its original request');
  await page.evaluate(()=>{Game.state.settings.lang='en';Game.applySettings();Game.navigate('shop');});assert((await page.locator('body').innerText()).includes('Open VK Play checkout'));
  await checkoutMode(true);await page.locator('[data-action="eco-product"][data-id="coins_7000"]').click();await page.locator('[data-action="eco-product"][data-id="coins_7000"]').click();await page.locator('[data-action="eco-retry-checkout"]').waitFor();assert((await page.locator('#modal-root').innerText()).includes('New attempt'));await checkoutMode(false);
  report.checks.push('English shop and explicit retry dialog render');await context.close();
  const preview=await browser.newContext({viewport:{width:1024,height:768},locale:'ru-RU'});await preview.addInitScript(()=>{window.Native={bootstrap:()=>({ready:true,preview:true,authorized:false,locale:'ru-RU'}),save:()=>true,api:async()=>({ok:false,status:401,error:'AUTH_REQUIRED'}),purchase:async()=>({ok:false,error:'PAYMENT_UNAVAILABLE'})};});const p=await preview.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(`http://127.0.0.1:${server.address().port}/index.html`);await until(p,()=>window.Game&&Platform.uiReady);await p.evaluate(()=>Game.navigate('shop'));assert.equal(await p.locator('[data-action="eco-product"]:enabled').count(),0);report.checks.push('1024x768 preview launches with all real-money purchases disabled');await preview.close();assert.deepEqual(report.errors,[]);report.passed=true;
 }finally{fs.writeFileSync(path.join(root,'evidence','browser-report.json'),JSON.stringify(report,null,2));await browser.close();server.close();fixture.kill();}
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exit(1);});
