'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {createOverlay}=require('../desktop/overlay.cjs');
const config={releaseConfigured:true,backendUrl:'https://example.test/',gcid:'0.2046788',paymentHosts:['vkplay.ru','co.vkpay.ru']};
const url='https://co.vkpay.ru/test?order=local%2F123&lang=ru&sign=private-signature';
function fixture(openExternal) {
  const calls=[],logs=[];
  const bridge=createOverlay(config,{platform:'win32',log:e=>logs.push(e),
    openExternal:async(...args)=>{calls.push(args);if(openExternal)await openExternal(...args);}});
  return {calls,logs,bridge};
}
test('unsupported platforms never dispatch a protocol',async()=>{
  const bridge=createOverlay(config,{platform:'linux',openExternal:()=>assert.fail('must not open')});
  assert.equal(bridge.initialize().available,false);
  assert.equal((await bridge.open(url)).error,'OVERLAY_UNSUPPORTED_PLATFORM');
});
test('dispatches the support-requested vkplay URI once and preserves the signed URL',async()=>{
  const {bridge,calls}=fixture();
  assert.deepEqual(await bridge.open(url),{ok:true,submitted:true,visible:null});
  assert.equal(calls.length,1);
  const uri=new URL(calls[0][0]);
  assert.equal(uri.protocol,'vkplay:');assert.equal(uri.hostname,'demandbrowserform');
  assert.equal(uri.pathname,'/0.2046788/');assert.equal(uri.searchParams.get('url'),url);
  assert.equal(uri.searchParams.get('width'),'80%');assert.equal(uri.searchParams.get('height'),'80%');
  assert.equal(uri.searchParams.get('caption'),'Nonogram - VK Play');
  assert.deepEqual(calls[0][1],{logUsage:true});
});
test('awaits Windows dispatch instead of treating an unresolved Promise as success',async()=>{
  let release;const pending=new Promise(resolve=>{release=resolve;});
  const {bridge}=fixture(()=>pending);let finished=false;
  const result=bridge.open(url).then(r=>{finished=true;return r;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(finished,false);
  release();assert.equal((await result).ok,true);
});
test('OS rejection is not successful checkout and never exposes exception text',async()=>{
  const {bridge,logs}=fixture(()=>{throw Error(url);});
  assert.deepEqual(await bridge.open(url),{ok:false,error:'PAYMENT_LAUNCH_FAILED'});
  assert.equal(bridge.status().submitted,false);
  assert.equal(logs.at(-1).event,'failed');assert(!JSON.stringify({logs,status:bridge.status()}).includes('private-signature'));
});
test('invalid and untrusted URLs never reach Windows',async()=>{
  const {bridge,calls}=fixture();
  for(const bad of [undefined,null,'','garbage','file:///c:/evil.exe','http://co.vkpay.ru/',
    'https://co.vkpay.ru.evil.test/','https://user@co.vkpay.ru/','https://co.vkpay.ru:444/',
    'https://co.vkpay.ru/\ncheckout','https://co.vkpay.ru/\0checkout','https://co.vkpay.ru/\\checkout'])
    assert.equal((await bridge.open(bad)).ok,false);
  assert.equal(calls.length,0);
});
test('oversized URLs fail explicitly rather than being truncated',async()=>{
  const {bridge,calls}=fixture();
  assert.equal((await bridge.open(url+'&padding='+'a'.repeat(2100))).error,'PAYMENT_URL_TOO_LONG');
  assert.equal(calls.length,0);
});
test('diagnostics contain only safe metadata, not the checkout URL or signature',async()=>{
  const {bridge,logs}=fixture();await bridge.open(url);
  assert.deepEqual(logs.map(x=>x.event),['requested','submitted']);
  assert.equal(logs[0].paymentHost,'co.vkpay.ru');assert.equal(logs[0].gcid,'0.2046788');
  const text=JSON.stringify(logs);for(const secret of [url,'private-signature','local%2F123','order='])assert(!text.includes(secret));
});
test('a logging failure never repeats or fails an accepted command',async()=>{
  let calls=0;const bridge=createOverlay(config,{platform:'win32',openExternal:async()=>{calls++;},log:()=>{throw Error('disk unavailable');}});
  assert.equal((await bridge.open(url)).ok,true);assert.equal(calls,1);
});
test('an explicit retry can succeed after an OS launch failure',async()=>{
  let fail=true;const {bridge,calls}=fixture(()=>{if(fail)throw Error('missing handler');});
  assert.equal((await bridge.open(url)).ok,false);fail=false;
  assert.equal((await bridge.open(url)).ok,true);assert.equal(calls.length,2);
  assert.equal(bridge.status().error,undefined);assert.equal(bridge.status().visible,null);
});
