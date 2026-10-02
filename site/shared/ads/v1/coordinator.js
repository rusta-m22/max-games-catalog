const result=(platform,reason,extra={})=>({platform,shown:false,rewarded:false,reason,...extra});
export class AdCoordinator{
 constructor(adapter,config={},hooks={}){this.adapter=adapter;this.platform=adapter.platform;this.config={enabled:true,interstitialCooldownMs:90000,requestTimeoutMs:120000,...config};this.hooks=hooks;this.busy=false;this.quarantined=false;this.lastInterstitial=-Infinity;this.used=new Set();this.seq=0;this.now=hooks.now||Date.now;}
 info(){return {apiVersion:1,version:'1.0.0',platform:this.platform,enabled:this.config.enabled&&this.platform!=='max',busy:this.busy,quarantined:this.quarantined,capabilities:this.platform==='max'||!this.config.enabled?{interstitial:false,rewarded:false}:{...this.adapter.capabilities}};}
 async afterRound(options={}){return this.show('interstitial',options);}
 async rewarded(options={}){return this.show('rewarded',options);}
 async show(type,options={}){
  if(this.platform==='max')return result(this.platform,'max-disabled');
  if(!this.config.enabled)return result(this.platform,'disabled');
  if(!this.adapter.capabilities[type])return result(this.platform,'unsupported');
  if(this.busy||this.quarantined)return result(this.platform,this.quarantined?'reload-required':'busy');
  if(type==='interstitial'&&this.now()-this.lastInterstitial<this.config.interstitialCooldownMs)return result(this.platform,'cooldown');
  if(this.hooks.isHidden?.())return result(this.platform,'background');
  const requestId=options.requestId||options.roundId||`${this.now()}-${++this.seq}`;
  const key=`${type}:${options.gameId||'game'}:${requestId}`;
  if(this.used.has(key))return result(this.platform,'duplicate');
  this.used.add(key);if(this.used.size>500)this.used.delete(this.used.values().next().value);
  this.busy=true;let opened=false,timedOut=false,timer;const controller=new AbortController();
  try{
   this.hooks.pause?.({type,placement:options.placement||'round-end'});
   const timeout=new Promise(resolve=>{timer=setTimeout(()=>{timedOut=true;controller.abort();resolve(result(this.platform,'timeout'));},this.config.requestTimeoutMs);});
   const request=Promise.resolve().then(()=>this.adapter.show(type,{signal:controller.signal,onOpen:()=>{if(controller.signal.aborted)return;opened=true;}}));
   let out=await Promise.race([request,timeout]);
   if(timedOut){out=result(this.platform,'timeout');this.quarantined=true;}
   if(type==='interstitial'&&(out.shown||opened||timedOut))this.lastInterstitial=this.now();
   return result(this.platform,out.reason||'closed',{shown:!!out.shown,rewarded:type==='rewarded'&&out.rewarded===true&&!timedOut,requestId});
  }catch{return result(this.platform,'sdk-error',{requestId});}
  finally{clearTimeout(timer);this.busy=false;try{this.hooks.resume?.({type,timedOut,documentHidden:!!this.hooks.isHidden?.()});}catch{}}
 }
}
