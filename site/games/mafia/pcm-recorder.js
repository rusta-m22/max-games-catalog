/* Web Audio capture avoids device-specific MediaRecorder codec failures. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./pcm-codec'));else root.MafiaPCMRecorder=factory(root.MafiaPCM);})(globalThis,function(PCM){
'use strict';
class PCMRecorder{
 constructor(options={}){
  this.o=options;const Context=options.AudioContext;if(!Context)throw Error('micUnsupported');
  try{this.audio=new Context({sampleRate:PCM.RATE});}catch{this.audio=new Context();}
  // Called synchronously by the Record click, before either permission or HTTP awaits.
  this.resumed=this.audio.resume().catch(()=>{});this.state='inactive';this.mimeType='audio/wav';this.chunks=[];this.samples=0;this.closed=false;
 }
 async prepare(stream){
  await this.resumed;if(this.closed)return;
  if(this.audio.state!=='running')throw Error('micSuspended');
  this.source=this.audio.createMediaStreamSource(stream);
  if(this.audio.audioWorklet&&this.o.AudioWorkletNode){try{
   await this.audio.audioWorklet.addModule(this.o.workletURL||'pcm-worklet.js');if(this.closed)return;
   this.node=new this.o.AudioWorkletNode(this.audio,'mafia-microphone-pcm',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});
   this.node.port.onmessage=e=>{if(e.data.pcm)this.collect(e.data.pcm);if(e.data.stopped)this.finish();};this.worklet=true;
  }catch{this.node=null;}}
  if(!this.node){
   this.encoder=new PCM.Resampler(this.audio.sampleRate,pcm=>this.collect(pcm));this.node=this.audio.createScriptProcessor(4096,1,1);
   this.node.onaudioprocess=e=>{if(this.state==='recording')this.encoder.push(e.inputBuffer.getChannelData(0));};
  }
 }
 collect(pcm){if(this.closed)return;this.chunks.push(pcm);this.samples+=pcm.length;let peak=0;for(const value of pcm)peak=Math.max(peak,Math.abs(value)/32768);this.o.onLevel?.(peak);}
 start(){if(this.closed||!this.node)throw Error('voiceFailed');this.state='recording';this.node.connect(this.audio.destination);this.source.connect(this.node);}
 stop(){if(this.state!=='recording')return;this.state='inactive';if(this.worklet)this.node.port.postMessage('stop');else{this.encoder.flush();this.finish();}}
 finish(){if(this.closed)return;const blob=PCM.wav(this.chunks);this.duration=this.samples/PCM.RATE;this.destroy();this.ondataavailable?.({data:blob});this.onstop?.();}
 destroy(){if(this.closed)return;this.closed=true;this.state='inactive';this.source?.disconnect();this.node?.disconnect();if(this.node?.port){this.node.port.onmessage=null;this.node.port.close();}if(this.node&&!this.worklet)this.node.onaudioprocess=null;this.chunks=[];this.audio.close().catch(()=>{});}
}
return {PCMRecorder};
});
