'use strict';
window.Platform={sdk:null,player:null,lang:null,readySent:false,uiReady:false,playing:false,paused:new Set(),accountSwitch:false,adBusy:false,lastAd:0,cloudTimer:null,cloudDirty:false,cloudPayload:null,cloudLast:0,cloudLoaded:false,
 async init(){
  
  const task=(async()=>{try{
   if(!window.JarvisLegacyPlatform)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='../../legacy-platform.js';s.async=true;s.onload=resolve;s.onerror=reject;document.head.appendChild(s);});
   this.sdk=await JarvisLegacyPlatform.init();this.sentPlaying=undefined;this.lang=this.sdk.environment?.i18n?.lang||'en';
   this.sdk.on?.('game_api_pause',()=>this.pause('sdk',true));this.sdk.on?.('game_api_resume',()=>this.pause('sdk',false));
   this.sdk.on?.('ACCOUNT_SELECTION_DIALOG_OPENED',()=>{this.accountSwitch=true;window.dispatchEvent(new Event('account-changing'));this.pause('account',true);clearTimeout(this.cloudTimer);});
   this.sdk.on?.('ACCOUNT_SELECTION_DIALOG_CLOSED',async()=>{await this.loadAccount(true);this.accountSwitch=false;this.pause('account',false);});
   window.dispatchEvent(new Event('platform-ready'));this.ready();this.syncPlay();
   await this.loadAccount(false);
  }catch(e){this.sdk=null;}})();
  await Promise.race([task,new Promise(r=>setTimeout(r,4500))]);
 },
 async loadAccount(changed=false,fallback=null){try{const player=await this.sdk.getPlayer();const data=await player.getData(['nonoworlds']);this.player=player;this.cloudLoaded=true;this.accountLoadFailed=false;this.cloudDirty=false;this.cloudPayload=null;window.dispatchEvent(new CustomEvent(changed?'account-data':'cloud-data',{detail:data.nonoworlds||fallback||null}));return true;}catch(e){this.cloudLoaded=false;if(changed){this.accountLoadFailed=true;this.player=null;window.dispatchEvent(new Event('account-load-error'));}return false;}},
 ready(){if(this.uiReady&&this.sdk&&!this.readySent){this.readySent=true;this.sdk.features?.LoadingAPI?.ready();}},
 pause(reason,value){value?this.paused.add(reason):this.paused.delete(reason);document.body.classList.toggle('paused',this.paused.size>0);document.body.classList.toggle('suspended',[...this.paused].some(k=>k!=='modal'));document.getElementById('platform-cover').hidden=!['sdk','ad','account'].some(k=>this.paused.has(k));if(this.paused.size)Sound.suspend();else Sound.resume();this.syncPlay();window.dispatchEvent(new Event('game-pause'));},
 setPlaying(value){this.playing=value;this.syncPlay();},
 syncPlay(){const next=!!(this.playing&&!this.paused.size);if(this.sentPlaying===next)return;this.sentPlaying=next;if(next)this.sdk?.features?.GameplayAPI?.start();else this.sdk?.features?.GameplayAPI?.stop();},
 save(data,urgent=false){this.cloudPayload=JSON.parse(JSON.stringify(data));this.cloudDirty=true;if(this.accountSwitch||!this.player||!this.cloudLoaded)return;clearTimeout(this.cloudTimer);const delay=Math.max(urgent?0:1800,10000-(Date.now()-this.cloudLast));this.cloudTimer=setTimeout(()=>this.flush(),delay);},
 async flush(){if(!this.player||!this.cloudLoaded||!this.cloudDirty||this.accountSwitch)return;this.cloudDirty=false;this.cloudLast=Date.now();try{await this.player.setData({nonoworlds:this.cloudPayload},true);}catch(e){this.cloudDirty=true;}},
 ad(rewarded=false,onReward,options={}){
  if(!rewarded&&options.placement==='mistake')return Promise.resolve(false); // Catalog ads only between completed rounds.

  const adv=this.sdk?.adv,method=rewarded?'showRewardedVideo':'showFullscreenAdv';
  if(typeof adv?.[method]!=='function'||this.adBusy)return Promise.resolve(false);
  if(!rewarded&&options.placement!=='mistake'&&Date.now()-this.lastAd<90000)return Promise.resolve(false);
  this.adBusy=true;this.pause('ad',true);
  return new Promise(resolve=>{
   let granted=false,settled=false,opened=false;
   const finish=wasShown=>{if(settled)return;settled=true;clearTimeout(watchdog);if(wasShown===true)this.lastAd=Date.now();this.adBusy=false;this.pause('ad',false);resolve(rewarded?granted:opened||wasShown===true);};
   const callbacks={onOpen:()=>{if(settled)return;opened=true;this.lastAd=Date.now();},onClose:finish,onError:()=>finish(false)};
   if(rewarded)callbacks.onRewarded=()=>{if(settled||granted)return;granted=true;onReward?.();};
   const watchdog=setTimeout(()=>{if(!opened)finish(false);},15000);
   try{adv[method]({callbacks});}catch(e){finish(false);}
  });
 },
 date(){let now;try{now=this.sdk?.serverTime?.();}catch(e){}return new Date(now||Date.now()).toISOString().slice(0,10);}
};
window.Sound={ctx:null,enabled:true,last:0,
 unlock(){if(!this.enabled||Platform.paused.size)return;try{this.ctx??=new(window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch(e){}},
 suspend(){if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});},resume(){if(this.enabled&&this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});},
 play(kind='tap'){if(!this.enabled||Platform.paused.size)return;this.unlock();if(!this.ctx||this.ctx.state!=='running')return;const now=this.ctx.currentTime;if(kind==='tap'&&now-this.last<.045)return;this.last=now;const notes=kind==='win'?[523,659,784,1046]:kind==='line'?[660,880]:kind==='error'?[180]:[420];notes.forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=now+i*.1;o.type='sine';o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.07,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+.17);});}
};
document.addEventListener('visibilitychange',()=>Platform.pause('hidden',document.hidden));
window.addEventListener('blur',()=>Platform.pause('blur',true));window.addEventListener('focus',()=>Platform.pause('blur',false));
document.addEventListener('pointerdown',()=>Sound.unlock(),{passive:true});document.addEventListener('contextmenu',e=>{if(e.target.closest('#app'))e.preventDefault();});document.addEventListener('dragstart',e=>e.preventDefault());
