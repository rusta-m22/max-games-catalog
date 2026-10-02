/* Turn-scoped recording. Only an explicit click requests the microphone. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.VoiceMessages=factory();})(globalThis,function(){
'use strict';
const TYPES=['audio/webm;codecs=opus','audio/webm','audio/mp4;codecs=mp4a.40.2','audio/mp4','audio/ogg;codecs=opus','audio/ogg'];
function reason(error){return {NotAllowedError:'micDenied',PermissionDeniedError:'micDenied',SecurityError:'micDenied',NotFoundError:'micMissing',NotReadableError:'micBusy',TrackStartError:'micBusy'}[error?.name]||error?.message||'voiceFailed';}
function microphonePolicyError(doc){try{const policy=doc?.permissionsPolicy||doc?.featurePolicy;return policy?.allowsFeature&&policy.allowsFeature('microphone')===false?'micPolicy':'';}catch{return '';}}
class Recorder{
 constructor(o={}){this.o=o;this.media=o.mediaDevices;this.Type=o.MediaRecorder;this.status='idle';this.error='';this.serial=0;this.context=null;this.stream=null;this.recorder=null;this.lease=null;this.clock=o.now||Date.now;this.schedule=o.setTimeout||((...args)=>globalThis.setTimeout(...args));this.unschedule=o.clearTimeout||(id=>globalThis.clearTimeout(id));this.timer=null;this.pending=null;this.controller=null;this.startedAt=0;}
 get supported(){return this.o.secure!==false&&!!this.media?.getUserMedia&&!!(this.Type||this.o.createPCM);}
 get accessError(){return this.o.secure===false?'micHttps':this.o.accessError?.()||(!this.supported?'micUnsupported':'');}
 get active(){return this.status!=='idle'&&this.status!=='error';}
 notify(status,error=''){this.status=status;this.error=error;this.o.onState?.(this);}
 tracks(stream=this.stream){try{for(const track of stream?.getTracks()||[])track.stop();}catch{}if(stream===this.stream)this.stream=null;}
 clearTimer(){if(this.timer!==null){this.unschedule(this.timer);this.timer=null;}}
 valid(serial,context){return serial===this.serial&&this.o.allowed(context);}
 native(stream){
  if(!this.Type)throw Error('micUnsupported');
  for(const mime of [...TYPES,'']){try{if(mime&&this.Type.isTypeSupported&&!this.Type.isTypeSupported(mime))continue;return new this.Type(stream,mime?{mimeType:mime,audioBitsPerSecond:64000}:{});}catch{}}
  throw Error('micUnsupported');
 }
 async start(context){
  if(this.active)return;const accessError=this.accessError;if(accessError){this.notify('error',accessError);return;}
  if(!this.o.allowed(context)){this.notify('error','notSpeaker');return;}
  const serial=++this.serial;this.context=context;this.diagnostic=null;this.notify('requesting');this.duration=0;let stream,lease,recorder,stage='microphone';
  try{
   // AudioContext must be unlocked in this gesture, not after getUserMedia resolves.
   try{recorder=this.o.createPCM?.();this.recorder=recorder;}catch{}
   stream=await this.media.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
   if(!this.valid(serial,context)){this.tracks(stream);recorder?.destroy?.();if(serial===this.serial)this.cancel();return;}
   this.stream=stream;
   stage='capture';if(recorder){try{await recorder.prepare(stream);}catch(e){recorder.destroy();if(!this.Type)throw e;recorder=null;}}
   if(!this.valid(serial,context)){this.tracks(stream);recorder?.destroy?.();if(serial===this.serial)this.cancel();return;}
   recorder ||= this.native(stream);this.recorder=recorder;
   stage='permission';const requestedAt=this.clock();lease=await this.o.grant(context);
   if(!this.valid(serial,context)){this.tracks(stream);recorder?.destroy?.();this.o.revoke?.(context,lease);if(serial===this.serial)this.cancel();return;}
   this.lease=lease;
   // A malformed/old response must never become setTimeout(NaN), i.e. an immediate stop.
   const remaining=Math.min(120000,Number(lease.until)-Number(lease.serverNow))-(this.clock()-requestedAt);
   if(!Number.isFinite(remaining)||remaining<=0)throw Error('speechEnded');
   this.chunks=[];this.bytes=0;this.startedAt=this.clock();
   recorder.ondataavailable=e=>{if(serial!==this.serial||!e.data?.size)return;this.bytes+=e.data.size;if(this.bytes>(lease.maxBytes||4194304)){this.cancel();this.notify('error','voiceLarge');return;}this.chunks.push(e.data);};
   recorder.onerror=()=>{if(serial===this.serial){this.cancel();this.notify('error','voiceFailed');}};
   recorder.onstop=()=>this.finalize(serial,context,lease,recorder.mimeType||this.chunks[0]?.type||'audio/webm');
   stage='recording';recorder.start();this.timer=this.schedule(()=>this.stop(),remaining);this.notify('recording');
  }catch(e){
   if(serial===this.serial){this.diagnostic={stage,name:String(e?.name||'Error'),message:String(e?.message||'').slice(0,180)};this.cancel();this.notify('error',this.o.accessError?.()||reason(e));}
   else{recorder?.destroy?.();this.tracks(stream);if(lease)this.o.revoke?.(context,lease);}
  }
 }
 stop(){
  if(this.pending)return this.pending;if(this.status==='requesting'){this.cancel();return Promise.resolve(false);}if(this.status!=='recording')return Promise.resolve(false);
  this.clearTimer();this.duration=Math.max(.1,(this.clock()-this.startedAt)/1000);this.pending=new Promise(resolve=>{this.resolve=resolve;});const pending=this.pending;this.notify('stopping');
  // Keep tracks alive until final dataavailable/onstop (or an explicit cancellation).
  this.timer=this.schedule(()=>{this.cancel();this.notify('error','voiceFailed');},5000);
  try{this.recorder.stop();}catch{this.cancel();this.notify('error','voiceFailed');}return pending;
 }
 async finalize(serial,context,lease,mime){
  if(serial!==this.serial)return;this.clearTimer();this.tracks();const duration=this.recorder?.duration||this.duration||Math.max(.1,(this.clock()-this.startedAt)/1000);const blob=new Blob(this.chunks,{type:mime});this.chunks=[];
  if(!blob.size){this.o.revoke?.(context,lease);this.lease=null;this.notify('error','voiceEmpty');this.complete(false);return;}
  this.controller=new AbortController();this.notify('uploading');try{await this.o.upload(context,lease,blob,Math.min(120,duration),this.controller.signal);if(serial===this.serial){this.lease=null;this.notify('idle');this.complete(true);}}catch(e){if(serial===this.serial){this.o.revoke?.(context,lease);this.lease=null;this.notify('error',reason(e));this.complete(false);}}
 }
 complete(ok){const resolve=this.resolve;this.resolve=null;this.pending=null;this.controller=null;resolve?.(ok);}
 cancel(){this.serial++;this.clearTimer();this.controller?.abort();const lease=this.lease;this.lease=null;if(lease)this.o.revoke?.(this.context,lease);try{if(this.recorder?.destroy)this.recorder.destroy();else if(this.recorder?.state!=='inactive')this.recorder?.stop();}catch{}this.tracks();this.chunks=[];this.recorder=null;this.complete(false);this.notify('idle');}
}
return {Recorder,TYPES,reason,microphonePolicyError};
});
