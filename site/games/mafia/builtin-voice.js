/* Built-in Russian voice; loaded only when selected or no Russian system voice exists. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MafiaBuiltinVoice=factory();})(globalThis,function(){
'use strict';
class BuiltinVoice{
 constructor(o={}){this.o=o;this.Context=o.AudioContext;this.Worker=o.Worker;this.supported=!!(this.Context&&this.Worker&&o.WebAssembly&&o.DecompressionStream);this.audio=null;this.worker=null;this.serial=0;this.job=null;this.source=null;this.speaking=false;}
 unlock(){if(!this.supported)return;try{if(!this.audio||this.audio.state==='closed')this.audio=new this.Context();this.resuming=this.audio.resume().catch(()=>{});}catch{}}
 ensureWorker(){if(this.worker)return;this.worker=new this.Worker(this.o.workerURL||'narrator-worker.mjs',{type:'module'});this.worker.onmessage=e=>this.deliver(e.data);this.worker.onerror=()=>{this.fail('error');this.worker?.terminate();this.worker=null;};}
 speak(text,{rate=1,volume=1,onStatus=()=>{}}={}){
  this.cancel();if(!this.supported)return false;
  if(!this.audio){onStatus('needs-click');return false;}
  const id=++this.serial;this.job={id,volume,onStatus};this.speaking=true;onStatus('loading-builtin');
  this.timeout=setTimeout(()=>{this.fail('error');this.worker?.terminate();this.worker=null;},60000);
  const begin=()=>{if(this.job?.id!==id)return;if(this.audio.state!=='running'){this.fail('needs-click');return;}try{this.ensureWorker();this.worker.postMessage({id,text,rate});}catch{this.fail('error');}};
  // resume() is asynchronous even when requested in an allowed user gesture.
  if(this.audio.state==='running')begin();else Promise.resolve(this.resuming).then(begin);return true;
 }
 deliver({id,pcm,sampleRate,error}){
  if(!this.job||id!==this.job.id)return;clearTimeout(this.timeout);if(error||!pcm?.length){this.fail('error');return;}
  if(this.audio.state!=='running'){this.fail('needs-click');return;}
  try{const buffer=this.audio.createBuffer(1,pcm.length,sampleRate),data=buffer.getChannelData(0);for(let i=0;i<pcm.length;i++)data[i]=pcm[i]/32768;
   const source=this.audio.createBufferSource(),gain=this.audio.createGain();this.source=source;this.gain=gain;source.buffer=buffer;gain.gain.value=this.job.volume;source.connect(gain);gain.connect(this.audio.destination);
   source.onended=()=>{if(this.job?.id!==id)return;const done=this.job.onStatus;this.cancel();done('ready-builtin');};source.start();this.job.onStatus('speaking');
  }catch{this.fail('error');}
 }
 fail(status){const cb=this.job?.onStatus;this.cancel();cb?.(status);}
 cancel(){++this.serial;clearTimeout(this.timeout);this.job=null;this.speaking=false;if(this.source){this.source.onended=null;try{this.source.stop();}catch{}this.source.disconnect();this.source=null;}this.gain?.disconnect();this.gain=null;}
 destroy(){this.cancel();this.worker?.terminate();this.worker=null;this.audio?.close();this.audio=null;}
}
return {BuiltinVoice};
});
