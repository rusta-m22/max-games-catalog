'use strict';
window.Platform={paused:new Set(),uiReady:false,playing:false,authorized:false,cloudLoaded:false,lang:null,
 async init(){const b=window.Native?.bootstrap()||{ready:false};this.authorized=!!b.authorized;this.cloudLoaded=this.authorized;this.preview=!!b.preview;this.lang=b.locale||navigator.language;this.login=b;window.dispatchEvent(new Event('platform-ready'));},
 ready(){},setPlaying(v){this.playing=v;},
 pause(reason,value){value?this.paused.add(reason):this.paused.delete(reason);document.body.classList.toggle('paused',this.paused.size>0);document.body.classList.toggle('suspended',[...this.paused].some(k=>k!=='modal'));document.getElementById('platform-cover').hidden=!this.paused.has('payment');if(this.paused.size)Sound.suspend();else Sound.resume();window.dispatchEvent(new Event('game-pause'));},
 save(){},flush(){},date(){return new Date().toISOString().slice(0,10);}
};
window.Sound={ctx:null,enabled:true,last:0,
 unlock(){if(!this.enabled||Platform.paused.size)return;try{this.ctx??=new(window.AudioContext||window.webkitAudioContext)();if(this.ctx.state==='suspended')this.ctx.resume().catch(()=>{});}catch(e){}},
 suspend(){if(this.ctx?.state==='running')this.ctx.suspend().catch(()=>{});},resume(){if(this.enabled&&this.ctx?.state==='suspended')this.ctx.resume().catch(()=>{});},
 play(kind='tap'){if(!this.enabled||Platform.paused.size)return;this.unlock();if(!this.ctx||this.ctx.state!=='running')return;const now=this.ctx.currentTime;if(kind==='tap'&&now-this.last<.045)return;this.last=now;const notes=kind==='win'?[523,659,784,1046]:kind==='line'?[660,880]:kind==='error'?[180]:[420];notes.forEach((f,i)=>{const o=this.ctx.createOscillator(),g=this.ctx.createGain(),t=now+i*.1;o.type='sine';o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.07,t+.008);g.gain.exponentialRampToValueAtTime(.001,t+.15);o.connect(g);g.connect(this.ctx.destination);o.start(t);o.stop(t+.17);});}
};
document.addEventListener('visibilitychange',()=>Platform.pause('hidden',document.hidden));
window.addEventListener('blur',()=>Platform.pause('blur',true));window.addEventListener('focus',()=>Platform.pause('blur',false));
document.addEventListener('pointerdown',()=>Sound.unlock(),{passive:true});document.addEventListener('contextmenu',e=>{if(e.target.closest('#app'))e.preventDefault();});document.addEventListener('dragstart',e=>e.preventDefault());
