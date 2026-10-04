// Original synthesized sounds; no downloads or music autoplay.
export function createAudio(enabled,isPaused){
 let context;
 function unlock(){if(!enabled()||isPaused())return;try{context??=new(window.AudioContext||window.webkitAudioContext)();context.resume().catch(()=>{});}catch{}}
 function play(type='clear',combo=1){
  if(!enabled()||isPaused())return;unlock();if(!context)return;
  const now=context.currentTime,base=523.25*Math.pow(2,Math.min(6,combo-1)/12);
  const notes=type==='win'?[523,659,784,1047]:type==='pulse'?[130,261,523,1047]:type==='resonance'?[659,830,1047]:type==='select'?[740]:type==='invalid'?[220,196]:[base,base*1.5];
  for(let i=0;i<notes.length;i++){
   const o=context.createOscillator(),g=context.createGain(),t=now+i*.065,duration=type==='select'?.07:type==='win'?.30:.17;
   o.type=type==='pulse'?'triangle':'sine';o.frequency.setValueAtTime(notes[i],t);o.frequency.exponentialRampToValueAtTime(notes[i]*1.007,t+duration);
   g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(type==='select'?.022:.043,t+.006);g.gain.exponentialRampToValueAtTime(.0001,t+duration);
   o.connect(g);g.connect(context.destination);o.start(t);o.stop(t+duration+.01);o.onended=()=>{o.disconnect();g.disconnect();};
  }
 }
 const pause=()=>context?.suspend().catch(()=>{}),resume=()=>{if(!document.hidden&&enabled()&&!isPaused())context?.resume().catch(()=>{});};
 const visibility=()=>document.hidden?pause():resume();
 document.addEventListener('visibilitychange',visibility);window.addEventListener('jarvis-ads-pause',pause);window.addEventListener('jarvis-ads-resume',resume);
 return {unlock,play,mute:pause,dispose(){document.removeEventListener('visibilitychange',visibility);window.removeEventListener('jarvis-ads-pause',pause);window.removeEventListener('jarvis-ads-resume',resume);context?.close().catch(()=>{});}};
}
