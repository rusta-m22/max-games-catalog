'use strict';
window.Platform={sdk:null,player:null,readySent:false,active:false,advert:false,paused:false,
 async init(){
  const script=document.createElement('script');script.src='../../legacy-platform.js';script.async=true;
  const boot=async()=>{try{this.sdk=await window.JarvisLegacyPlatform.init();this.sdk.on?.('game_api_pause',()=>{this.paused=true;window.dispatchEvent(new Event('platformpause'));});this.sdk.on?.('game_api_resume',()=>{this.paused=false;window.dispatchEvent(new Event('platformresume'));});window.dispatchEvent(new CustomEvent('platformready',{detail:this.sdk.environment?.i18n?.lang||'en'}));if(this.readySent)this.sdk.features?.LoadingAPI?.ready();try{this.player=await this.sdk.getPlayer({scopes:false});const data=await this.player.getData(['mafiaStats']);if(data.mafiaStats)window.dispatchEvent(new CustomEvent('cloudstats',{detail:data.mafiaStats}));}catch{}}catch{}}
  await new Promise(resolve=>{let finished=false;const done=()=>{if(!finished){finished=true;resolve();}};script.onload=()=>{boot().finally(done);};script.onerror=done;document.head.append(script);setTimeout(done,4500);});
 },ready(){this.readySent=true;this.sdk?.features?.LoadingAPI?.ready();},
 gameplay(active){active=!!active&&!document.hidden&&!this.paused&&!this.advert;if(this.active===active)return;this.active=active;try{this.sdk?.features?.GameplayAPI?.[active?'start':'stop']();}catch{}},
 async saveStats(stats){try{await this.player?.setData({mafiaStats:stats},true);if(await this.sdk?.isAvailableMethod('leaderboards.setScore'))await this.sdk.leaderboards.setScore(window.MAFIA_CONFIG.leaderboard,stats.wins);}catch{}},
 async scores(){if(!this.sdk?.leaderboards)throw Error('leaderboard');return this.sdk.leaderboards.getEntries(window.MAFIA_CONFIG.leaderboard,{quantityTop:10,includeUser:true,quantityAround:1});},
 ad(){if(!this.sdk?.adv)return Promise.resolve();this.advert=true;this.gameplay(false);window.dispatchEvent(new Event('platformpause'));return new Promise(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;this.advert=false;window.dispatchEvent(new Event('platformresume'));resolve();};try{this.sdk.adv.showFullscreenAdv({callbacks:{onClose:finish,onError:finish}});}catch{finish();}});}
};
