'use strict';
const crypto=require('node:crypto');
function launchArgs(argv){
 const result={preview:argv.includes('--preview')};
 const rules={'--sz_pers_id=':['uid',/^[0-9]{1,24}$/],'--sz_token=':['otp',/^[\s\S]{8,4096}$/],'-my_ui_locale_arg=':['locale',/^[a-zA-Z_-]{2,32}$/],'-my_ui_currency_arg=':['currency',/^[A-Z]{3}$/]};
 for(const a of argv)for(const [prefix,[key,re]] of Object.entries(rules))if(a.startsWith(prefix)){const v=a.slice(prefix.length);if(result[key]!==undefined||!re.test(v))throw new Error('INVALID_LAUNCH_ARGUMENTS');result[key]=v;}
 return result;
}
function checkConfig(c){
 if(!c.releaseConfigured)throw new Error('BUILD_NOT_CONFIGURED');
 const u=new URL(c.backendUrl);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.pathname!=='/'||!/^\d+\.\d+$/.test(c.gcid)||!Array.isArray(c.paymentHosts)||!c.paymentHosts.length)throw new Error('INVALID_CONFIG');return c;
}
function overlayUrl(url,c){
 checkConfig(c);
 if(typeof url!=='string'||!url||/[\u0000-\u0020\u007f\\]/.test(url))throw new Error('INVALID_PAYMENT_URL');
 const u=new URL(url);
 if(u.protocol!=='https:'||u.username||u.password||u.port||!c.paymentHosts.includes(u.hostname))throw new Error('UNEXPECTED_PAYMENT_HOST');
 // VK Play support requested vkplay:// on 2026-10-21. Docs still show mycomgames://.
 // Encode the ORIGINAL signed URL exactly once, not u.href. No cmd/start.
 const command='vkplay://demandbrowserform/'+c.gcid+'/?url='+encodeURIComponent(url)+
  '&width=80%&height=80%&caption='+encodeURIComponent('Нонограммы — Мир пикселей');
 if(command.length>2081)throw new Error('PAYMENT_URL_TOO_LONG');
 return command;
}
function allowedRequest(route,payload){if(typeof route!=='string')return false;if(payload===undefined)return ['/api/wallet','/api/catalog','/api/progress'].includes(route)||/^\/api\/rank\?kind=(daily|weekly)$/.test(route)||/^\/api\/vkplay\/order\?id=[A-Za-z0-9_-]{8,100}$/.test(route);return ['/api/action','/api/rank/start','/api/rank/finish'].includes(route)&&payload!==null&&typeof payload==='object'&&!Array.isArray(payload);}
function seal(value,key){const data=JSON.stringify(value);if(Buffer.byteLength(data)>500000)throw new Error('SAVE_TOO_LARGE');return JSON.stringify({data,mac:crypto.createHmac('sha256',key).update(data).digest('hex')});}
function unseal(raw,key){const {data,mac}=JSON.parse(raw);if(typeof data!=='string'||Buffer.byteLength(data)>500000||typeof mac!=='string'||!/^[0-9a-f]{64}$/.test(mac))throw new Error('INVALID_SAVE');const check=crypto.createHmac('sha256',key).update(data).digest();if(!crypto.timingSafeEqual(check,Buffer.from(mac,'hex')))throw new Error('INVALID_SAVE');return JSON.parse(data);}
module.exports={launchArgs,checkConfig,overlayUrl,allowedRequest,seal,unseal};
