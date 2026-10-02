import {detectPlatform} from './detect.js';
import {DisabledAdapter,YandexAdapter,VKAdapter} from './adapters.js';
import {AdCoordinator} from './coordinator.js';
export const apiVersion=1;
export async function createAds(env=window,config={}){const platform=detectPlatform(env,config);let adapter=platform==='yandex'?new YandexAdapter(env,config):platform==='vk'?new VKAdapter(env,config):new DisabledAdapter(platform),timer;try{await Promise.race([adapter.init(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('sdk-timeout')),config.sdkTimeoutMs||7000);})]);}catch{adapter=new DisabledAdapter(platform);}finally{clearTimeout(timer);}
 const emit=(name,detail)=>{try{env.dispatchEvent(new env.CustomEvent(name,{detail}));for(const f of env.document.querySelectorAll('iframe')){try{f.contentWindow.dispatchEvent(new f.contentWindow.CustomEvent(name,{detail}));}catch{}}}catch{}};
 const manager=new AdCoordinator(adapter,config,{pause:detail=>emit('jarvis-ads-pause',detail),resume:detail=>emit('jarvis-ads-resume',detail),isHidden:()=>env.document.hidden});
 // A bridge may expose launch data after the initial page scripts have run.
 // Recheck before every call so MAX can never fall through to another adapter.
 const show=manager.show.bind(manager);
 manager.show=(type,options)=>detectPlatform(env,config)==='max'?Promise.resolve({platform:'max',shown:false,rewarded:false,reason:'max-disabled'}):show(type,options);
 const info=manager.info.bind(manager);
 manager.info=()=>detectPlatform(env,config)==='max'?{...info(),platform:'max',enabled:false,capabilities:{interstitial:false,rewarded:false}}:info();
 manager.ready=async()=>manager.info();manager.getPlatformSdk=()=>detectPlatform(env,config)==='max'?null:adapter.sdk||null;
 return manager;
}
