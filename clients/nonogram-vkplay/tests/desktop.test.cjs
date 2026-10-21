const test=require('node:test'),assert=require('node:assert/strict');
const {launchArgs,checkConfig,overlayUrl,allowedRequest,seal,unseal}=require('../desktop/platform-core.cjs');
const cfg={releaseConfigured:true,backendUrl:'https://backend.example/',gcid:'0.123456',paymentHosts:require('../desktop/config.json').paymentHosts};
test('Game Center arguments',()=>assert.deepEqual(launchArgs(['--sz_pers_id=42','--sz_token=abcdefghi','-my_ui_locale_arg=ru-RU','-my_ui_currency_arg=RUB']),{preview:false,uid:'42',otp:'abcdefghi',locale:'ru-RU',currency:'RUB'}));
test('duplicate args rejected',()=>assert.throws(()=>launchArgs(['--sz_pers_id=42','--sz_pers_id=43'])));
test('unconfigured release rejected',()=>assert.throws(()=>checkConfig({...cfg,releaseConfigured:false})));
test('insecure backend rejected',()=>assert.throws(()=>checkConfig({...cfg,backendUrl:'http://backend.example/'})));
test('configured HTTPS backend',()=>assert.equal(checkConfig(cfg),cfg));
test('overlay URL preserves payment query',()=>assert.equal(new URL(overlayUrl('https://vkplay.ru/pay?a=1&b=2',cfg)).searchParams.get('url'),'https://vkplay.ru/pay?a=1&b=2'));
test('VK Pay checkout preserves nested parameters in the Game Center URL',()=>{const payment='https://co.vkpay.ru/checkout?order=local%2F123&return_url=https%3A%2F%2Fvkplay.ru%2F';const u=new URL(overlayUrl(payment,cfg));assert.equal(u.protocol,'vkplay:');assert.equal(u.host,'demandbrowserform');assert.equal(u.pathname,'/0.123456/');assert.equal(u.searchParams.get('url'),payment);});
test('VK Pay allowlist accepts only the exact HTTPS origin',()=>{for(const url of ['https://co.vkpay.ru.evil.example/pay','https://co-vkpay.ru/pay','https://other.vkpay.ru/pay','http://co.vkpay.ru/pay','https://co.vkpay.ru:444/pay','https://user:password@co.vkpay.ru/pay'])assert.throws(()=>overlayUrl(url,cfg));});
test('external protocols rejected',()=>assert.throws(()=>overlayUrl('file:///c:/evil.exe',cfg)));
test('lookalike hosts rejected',()=>assert.throws(()=>overlayUrl('https://vkplay.ru.evil.example',cfg)));
test('embedded credentials rejected',()=>assert.throws(()=>overlayUrl('https://user:pass@vkplay.ru/pay',cfg)));
test('renderer cannot call auth or callback',()=>{assert.equal(allowedRequest('/api/vkplay/auth',{}),false);assert.equal(allowedRequest('/api/vkplay/callback',{}),false);});
test('renderer cannot create arbitrary checkout',()=>assert.equal(allowedRequest('/api/vkplay/order',{}),false));
test('wallet read allowed',()=>assert.equal(allowedRequest('/api/wallet'),true));
test('saves survive seal/unseal',()=>assert.deepEqual(unseal(seal({version:1,coins:120},'key'),'key'),{version:1,coins:120}));
test('edited local balance rejected',()=>assert.throws(()=>unseal(seal({coins:120},'key').replace('120','999'),'key')));
test('another account key rejected',()=>assert.throws(()=>unseal(seal({coins:120},'key'),'other-key')));

test('protocol wrapping preserves URL bytes including nested encoding and plus signs',()=>{
 const payment='https://co.vkpay.ru/a/../checkout?sign=a%2Fb%2Bc+z&next=https%3A%2F%2Fvkplay.ru%2F%3Fx%3D1%26y%3D2#section';
 const uri=new URL(overlayUrl(payment,cfg));
 assert.equal(uri.searchParams.get('url'),payment);
 assert.equal(uri.searchParams.get('width'),'80%');assert.equal(uri.searchParams.get('height'),'80%');
 assert.deepEqual([...uri.searchParams.keys()],['url','width','height','caption']);
});
