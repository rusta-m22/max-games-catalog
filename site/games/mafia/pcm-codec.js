/* Mono 16 kHz PCM. Shared by the microphone worklet and its compatibility path. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MafiaPCM=factory();})(globalThis,function(){
'use strict';
const RATE=16000,MAX_SAMPLES=RATE*120;
class Resampler{
 constructor(rate,emit){this.step=rate/RATE;this.left=this.step;this.sum=0;this.emit=emit;this.chunk=new Int16Array(1600);this.used=0;this.samples=0;}
 push(input){
  for(let i=0;i<input.length&&this.samples<MAX_SAMPLES;i++){
   let rest=1;const value=Math.max(-1,Math.min(1,input[i]||0));
   while(rest>1e-8&&this.samples<MAX_SAMPLES){const n=Math.min(rest,this.left);this.sum+=value*n;this.left-=n;rest-=n;
    if(this.left<1e-8){const v=this.sum/this.step;this.chunk[this.used++]=Math.round(v*(v<0?32768:32767));this.samples++;this.left=this.step;this.sum=0;if(this.used===this.chunk.length)this.flush();}
   }
  }
 }
 flush(){if(!this.used)return;const chunk=this.chunk.slice(0,this.used);this.used=0;this.emit(chunk);}
}
function wav(chunks){
 const count=chunks.reduce((n,c)=>n+c.length,0);if(!count)return new Blob([],{type:'audio/wav'});
 const header=new ArrayBuffer(44),v=new DataView(header),word=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
 word(0,'RIFF');v.setUint32(4,36+count*2,true);word(8,'WAVE');word(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,RATE,true);v.setUint32(28,RATE*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);word(36,'data');v.setUint32(40,count*2,true);
 // Explicit little endian also works on platforms whose native byte order differs.
 const pcm=new DataView(new ArrayBuffer(count*2));let at=0;for(const chunk of chunks)for(const sample of chunk){pcm.setInt16(at,sample,true);at+=2;}
 return new Blob([header,pcm.buffer],{type:'audio/wav'});
}
return {RATE,MAX_SAMPLES,Resampler,wav};
});
