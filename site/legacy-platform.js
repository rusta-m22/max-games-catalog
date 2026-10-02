// Compatibility port for existing HTML5/Godot games. Not a Yandex SDK.
(function(){'use strict';if(window.JarvisLegacyPlatform)return;const callbacks=new Map(),noop=()=>{};let initialized;
 // Hide unavailable video offers even when a legacy game rebuilds its DOM.
 const root=document.documentElement,style=document.createElement('style');
 root.classList.add('jarvis-no-rewarded');
 const selectors=['[data-action="reward-hint"]','[data-action="reward-life"]','[data-action="eco-ad"]','.ad-reward'];
 if(/\/logic\//.test(location.pathname))selectors.push('#hint','.free-info');
 style.textContent=selectors.map(s=>'.jarvis-no-rewarded '+s).join(',')+'{display:none!important}';
 document.head.append(style);
 window.JarvisAdsReady?.then(ads=>root.classList.toggle('jarvis-no-rewarded',!ads.info().capabilities.rewarded));
 const emit=event=>{for(const fn of callbacks.get(event)||[]){try{fn();}catch{}}};
 window.addEventListener('jarvis-ads-pause',()=>emit('game_api_pause'));
 window.addEventListener('jarvis-ads-resume',()=>emit('game_api_resume'));
 window.JarvisLegacyPlatform={init(){return initialized??=(async()=>{
  const ads=await window.JarvisAdsReady;
  const real=ads?.getPlatformSdk?.();
  const language=real?.environment?.i18n?.lang||'ru';
  const key='jarvis-legacy:'+location.pathname.split('/').slice(-2,-1)[0];
  const get=()=>{try{return JSON.parse(localStorage.getItem(key))||{};}catch{return {};}};
  const player={isAuthorized:()=>false,getName:()=>'',getPhoto:()=>'',getUniqueID:()=>'',getData:async keys=>{const data=get();return keys?Object.fromEntries(keys.map(k=>[k,data[k]])):data;},setData:async data=>{try{localStorage.setItem(key,JSON.stringify({...get(),...data}));}catch{}},getStats:async()=>({}),setStats:async()=>{}};
  const api={environment:{i18n:{lang:language}},features:{LoadingAPI:{ready:()=>real?.features?.LoadingAPI?.ready?.()},GameplayAPI:{start:()=>real?.features?.GameplayAPI?.start?.(),stop:()=>real?.features?.GameplayAPI?.stop?.()}},on(event,fn){if(!callbacks.has(event))callbacks.set(event,new Set());callbacks.get(event).add(fn);real?.on?.(event,fn);},off(event,fn){callbacks.get(event)?.delete(fn);real?.off?.(event,fn);},deviceInfo:{isMobile:()=>matchMedia('(pointer:coarse)').matches,isDesktop:()=>!matchMedia('(pointer:coarse)').matches},serverTime:()=>Date.now(),getPlayer:async options=>real?real.getPlayer(options):player,isAvailableMethod:async()=>false,auth:{openAuthDialog:async()=>{throw Error('Авторизация недоступна на этой площадке');}},adv:{
   async showFullscreenAdv({callbacks:c={}}={}){const r=await ads?.afterRound({gameId:key,placement:'legacy-round-end'});c.onClose?.(!!r?.shown);},
   async showRewardedVideo({callbacks:c={}}={}){const r=await ads?.rewarded({gameId:key,placement:'legacy-bonus'});if(r?.rewarded)c.onRewarded?.();if(!r?.shown&&!r?.rewarded)c.onError?.({code:r?.reason||'unavailable'});c.onClose?.(!!r?.shown);}
  }};
  if(real?.leaderboards)api.leaderboards=real.leaderboards;
  return api;
 })();}};
 // Old Godot exports may refer to YaGames from compiled scripts.
 if(!window.YaGames)window.YaGames={__jarvisCompat:true,init:()=>window.JarvisLegacyPlatform.init()};
})();
