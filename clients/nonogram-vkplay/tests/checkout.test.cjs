'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createCheckout}=require('../desktop/checkout.cjs');
const {createOverlay}=require('../desktop/overlay.cjs');
const cfg={releaseConfigured:true,backendUrl:'https://example.test/',gcid:'0.2046788',paymentHosts:['co.vkpay.ru']};
test('every product reaches the protocol dispatcher with its own server-signed URL',async()=>{
 const calls=[],logs=[];
 const checkout=createCheckout({api:async(_route,{product})=>({ok:true,value:{orderId:'private-order',status:'pending',paymentUrl:'https://co.vkpay.ru/pay?item='+product+'&sign=private-signature'}}),overlay:createOverlay(cfg,{platform:'win32',openExternal:async url=>calls.push(url)}),log:e=>logs.push(e)});
 for(const product of ['coins_500','coins_1200','coins_3000','coins_7000','starter']){
  const r=await checkout(product,'request-123');assert.equal(r.ok,true);
  assert.equal(new URL(new URL(calls.at(-1)).searchParams.get('url')).searchParams.get('item'),product);
 }
 assert.equal(calls.length,5);assert.equal(logs.filter(e=>e.event==='checkout_submitted').length,5);
 for(const secret of ['private-order','private-signature','request-123','https://'])assert(!JSON.stringify(logs).includes(secret));
});
test('rechecking an unpaid cached order never dispatches its broken link',async()=>{
 const checkout=createCheckout({api:async()=>({ok:true,value:{orderId:'old',status:'pending',paymentUrl:'bad cached URL'}}),overlay:{open:()=>assert.fail('must not reopen')}});
 assert.deepEqual(await checkout('coins_3000','request-123',true),{ok:true,value:{orderId:'old',status:'pending'}});
});
test('paid orders do not open another payment window',async()=>{
 const checkout=createCheckout({api:async()=>({ok:true,value:{orderId:'old',status:'paid'}}),overlay:{open:()=>assert.fail('must not open')}});
 for(const check of [true,false])assert.equal((await checkout('coins_3000','request-123',check)).value.status,'paid');
});
test('invalid product/request never reaches the backend',async()=>{
 const checkout=createCheckout({api:()=>assert.fail('invalid request'),overlay:{}});
 for(const args of [['coins_999','request-123'],['coins_3000','short']])assert.equal((await checkout(...args)).error,'INVALID_PRODUCT');
});
test('server and OS failures retain their stage and can be retried without overlapping',async()=>{
 let release;const hold=new Promise(r=>release=r),logs=[];
 const checkout=createCheckout({api:async()=>{await hold;return {ok:true,value:{paymentUrl:'https://co.vkpay.ru/pay',status:'pending'}};},overlay:{open:async()=>({ok:false,error:'PAYMENT_LAUNCH_FAILED'})},log:e=>logs.push(e)});
 const first=checkout('coins_3000','request-123');assert.equal((await checkout('coins_3000','request-123')).error,'PAYMENT_UNAVAILABLE');
 release();assert.equal((await first).error,'PAYMENT_LAUNCH_FAILED');assert.equal((await checkout('coins_3000','request-123')).error,'PAYMENT_LAUNCH_FAILED');
 assert.equal(logs.at(-1).product,'coins_3000');assert.equal(logs.at(-1).event,'checkout_failed');
 const failed=createCheckout({api:async()=>({ok:false,status:502,error:'VKPLAY_BILLING_REJECTED'}),overlay:{open:()=>assert.fail()},log:e=>logs.push(e)});
 assert.equal((await failed('coins_3000','request-123')).error,'VKPLAY_BILLING_REJECTED');assert.equal(logs.at(-1).event,'order_failed');
});
