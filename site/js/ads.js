// The only advertising API used by new game modules.
export let adsPaused=false;
window.addEventListener('jarvis-ads-pause',()=>{adsPaused=true;document.documentElement.classList.add('ad-paused');});
window.addEventListener('jarvis-ads-resume',()=>{adsPaused=false;document.documentElement.classList.remove('ad-paused');});
export async function afterRound(gameId,roundId){const ads=await window.JarvisAdsReady;return ads?.afterRound({gameId,roundId,placement:'round-end'})||{shown:false,rewarded:false,reason:'unavailable'};}
export function rewardedButton(label,grant,gameId,placement='bonus'){const b=document.createElement('button');b.textContent=label+' · видео';b.hidden=true;let busy=false;window.JarvisAdsReady?.then(ads=>{b.hidden=!ads.info().capabilities.rewarded;});b.onclick=async()=>{if(busy||adsPaused)return;busy=true;b.disabled=true;try{const ads=await window.JarvisAdsReady;const r=await ads?.rewarded({gameId,placement});if(r?.rewarded)grant();else window.dispatchEvent(new CustomEvent('jarvis-ad-unavailable',{detail:r?.reason||'unavailable'}));}finally{busy=false;b.disabled=false;}};return b;}
