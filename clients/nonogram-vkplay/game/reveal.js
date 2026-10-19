'use strict';
/* Each subject has its own bundled artwork. No grid-to-image filter. */
window.RevealArt=(()=>{
 const data=window.REVEAL_DATA,media=matchMedia('(prefers-reduced-motion: reduce)'),preloaded=new Map();
 const escape=s=>String(s||'').replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
 function entry(p){const assignment=data.levels[p.revealId||p.sourceId||p.id];return assignment?{...assignment,...data.assets[assignment.key]}:null;}
 function canAnimate(){return !document.body.classList.contains('reduced')&&!media.matches&&!document.hidden&&![...(window.Platform?.paused||[])].some(reason=>reason!=='modal');}
 function sync(){const play=canAnimate();document.querySelectorAll('img[data-animation-src]').forEach(img=>{const src=play?img.dataset.animationSrc:img.dataset.stillSrc;if(img.getAttribute('src')!==src)img.src=src;});}
 function card(p,size=260,animated=false,options={}){
  const art=entry(p),label=escape(p.name?.[document.documentElement.lang==='en'?1:0]);
  if(!art)return `<figure class="art-reveal art-unavailable" style="--art-size:${size}px"><span>${document.documentElement.lang==='en'?'Picture unavailable':'Картинка недоступна'}</span></figure>`;
  const crop=options.full?null:art.crop,thumb=!!options.thumb;
  const src=art.animated&&(!animated||!canAnimate())?art.still:art.src;
  const gif=art.animated&&animated?` data-animation-src="${art.src}" data-still-src="${art.still}"`:'';
  const cropStyle=crop?` style="width:${crop[2]*100}%;height:${crop[2]*100}%;left:${-crop[0]*100}%;top:${-crop[1]*100}%"`:'';
  return `<figure class="art-reveal ${art.kind==='scene'?'art-scene':'art-object'} ${crop?'art-fragment':''} ${animated?'is-animated':''} ${thumb?'art-thumb':''} ${art.animated?'art-gif':''}" data-art-key="${art.key}" style="--art-size:${size}px" role="img" aria-label="${label}"><div class="art-halo" aria-hidden="true"></div><div class="art-viewport"><img class="reveal-image" src="${src}"${gif}${cropStyle} width="768" height="768" alt="" draggable="false" decoding="async" loading="${thumb?'lazy':'eager'}"></div>${animated?'<i class="art-shimmer" aria-hidden="true"></i><span class="art-spark spark-a" aria-hidden="true">✦</span><span class="art-spark spark-b" aria-hidden="true">✧</span><span class="art-spark spark-c" aria-hidden="true">✦</span>':''}</figure>`;
 }
 function preload(p){const art=entry(p);if(!art)return;for(const src of [art.src,art.still].filter(Boolean)){if(preloaded.has(src))continue;const img=new Image();img.src=src;preloaded.set(src,img);if(preloaded.size>12)preloaded.delete(preloaded.keys().next().value);}}
 window.addEventListener('game-pause',sync);media.addEventListener('change',sync);
 document.addEventListener('error',e=>{if(e.target.matches?.('.reveal-image'))e.target.closest('.art-reveal')?.classList.add('art-load-error');},true);
 return {entry,card,preload,sync};
})();
