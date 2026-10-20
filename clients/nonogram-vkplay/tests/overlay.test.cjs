'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createOverlay}=require('../desktop/overlay.cjs');
const config={releaseConfigured:true,backendUrl:'https://example.test/',gcid:'0.2046788',paymentHosts:['vkplay.ru','co.vkpay.ru']};
const url='https://co.vkpay.ru/test?order=local%2F123&lang=ru';
function fixture(openResult={accepted:true,overlayState:0}) {
  const calls=[];
  return {calls,native:{
    initialize:()=>({available:true,connected:true,overlayState:0}),
    status:()=>({available:true,connected:true,overlayState:0}),
    open:value=>{calls.push(value);return openResult;}
  }};
}
test('unsupported platform never loads a native DLL',()=>{
  const b=createOverlay(config,{platform:'linux',load:()=>{throw Error('must not load');}});
  assert.equal(b.initialize().error,'OVERLAY_UNSUPPORTED_PLATFORM');
  assert.equal(b.open(url).ok,false);
});
test('passes the original signed payment URL to the SDK once',()=>{
  const f=fixture({accepted:true,overlayState:1});
  const b=createOverlay(config,{platform:'win32',load:()=>f.native});
  assert.deepEqual(b.open(url),{ok:true,visible:true});assert.deepEqual(f.calls,[url]);
});
test('SDK acceptance is not evidence of a visible window',()=>{
  const f=fixture();const b=createOverlay(config,{platform:'win32',load:()=>f.native});
  assert.deepEqual(b.open(url),{ok:true,visible:false});
});
test('a rejected form never reports success',()=>{
  const f=fixture({accepted:false,error:'OVERLAY_FORM_REJECTED'});
  assert.deepEqual(createOverlay(config,{platform:'win32',load:()=>f.native}).open(url),
    {ok:false,error:'OVERLAY_FORM_REJECTED'});
});
test('disconnected Game Center is distinguished from successful checkout',()=>{
  const f=fixture({accepted:false,error:'GAME_CENTER_NOT_CONNECTED'});
  assert.equal(createOverlay(config,{platform:'win32',load:()=>f.native}).open(url).error,'GAME_CENTER_NOT_CONNECTED');
});
test('untrusted or control-character URLs never reach the native loader',()=>{
  let loads=0;const b=createOverlay(config,{platform:'win32',load:()=>{loads++;return fixture().native;}});
  for(const bad of ['http://co.vkpay.ru/','https://co.vkpay.ru.evil.test/','https://user@co.vkpay.ru/',
    'https://co.vkpay.ru:444/','https://co.vkpay.ru/\ncheckout','https://co.vkpay.ru/\0checkout'])
    assert.throws(()=>b.open(bad));
  assert.equal(loads,0);
});
test('loader errors reveal no file paths or sensitive values',()=>{
  const b=createOverlay(config,{platform:'win32',load:()=>{throw Error('private/path/token');}});
  assert.deepEqual(b.open(url),{ok:false,error:'OVERLAY_BRIDGE_UNAVAILABLE'});
  assert(!JSON.stringify(b.status()).includes('private'));
});
test('SDK attachment can be retried after Game Center becomes ready',()=>{
  let ready=false,init=0;
  const n={initialize:()=>{init++;return ready?{available:true}:{available:false,error:'OVERLAY_NOT_LOADED'};},
    status:()=>({available:ready}),open:()=>({accepted:true,overlayState:0})};
  const b=createOverlay(config,{platform:'win32',load:()=>n});
  assert.equal(b.open(url).ok,false);ready=true;assert.equal(b.open(url).ok,true);assert.equal(init,2);
});
test('native exceptions are reduced to a fixed code',()=>{
  const n=fixture().native;n.open=()=>{throw Error(url);};
  assert.deepEqual(createOverlay(config,{platform:'win32',load:()=>n}).open(url),
    {ok:false,error:'OVERLAY_BRIDGE_UNAVAILABLE'});
});
