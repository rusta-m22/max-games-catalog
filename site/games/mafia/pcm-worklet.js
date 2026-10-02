import './pcm-codec.js';
class MicrophonePCM extends AudioWorkletProcessor{
 constructor(){super();this.active=true;this.encoder=new globalThis.MafiaPCM.Resampler(sampleRate,pcm=>this.port.postMessage({pcm},[pcm.buffer]));this.port.onmessage=e=>{if(e.data==='stop'){this.active=false;this.encoder.flush();this.port.postMessage({stopped:true});}};}
 process(inputs){if(this.active&&inputs[0]?.[0])this.encoder.push(inputs[0][0]);return this.active;}
}
registerProcessor('mafia-microphone-pcm',MicrophonePCM);
