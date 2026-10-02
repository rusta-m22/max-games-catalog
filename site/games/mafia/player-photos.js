/* Local thumbnail creation and room-scoped, authenticated photo caching. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.MafiaPhotos=factory();})(globalThis,function(){
'use strict';
const SIZE=256,MAX_BYTES=48*1024,MAX_FILE=16*1024*1024;
function validDataURL(value){return typeof value==='string'&&value.length<=MAX_BYTES*4/3+23&&/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);}
function loadImage(file){return new Promise((resolve,reject)=>{
 const url=URL.createObjectURL(file),image=new Image();
 image.onload=()=>{URL.revokeObjectURL(url);resolve(image);};image.onerror=()=>{URL.revokeObjectURL(url);reject(Error('photoFormat'));};image.src=url;
});}
async function prepare(file,options={}){
 if(!file||file.size<=0)throw Error('photoFormat');if(file.size>MAX_FILE)throw Error('photoFileLarge');
 if(!/^image\/(jpeg|png|webp)$/i.test(file.type))throw Error('photoFormat');
 const image=await (options.loadImage||loadImage)(file),width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
 if(!width||!height||width*height>50000000)throw Error('photoDimensions');
 const canvas=(options.createCanvas||(()=>document.createElement('canvas')))();canvas.width=canvas.height=SIZE;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('photoFormat');
 const edge=Math.min(width,height);ctx.fillStyle='#142634';ctx.fillRect(0,0,SIZE,SIZE);ctx.drawImage(image,(width-edge)/2,(height-edge)/2,edge,edge,0,0,SIZE,SIZE);
 for(const quality of [.84,.68,.5]){const data=canvas.toDataURL('image/jpeg',quality);if(validDataURL(data))return data;}
 throw Error('photoLarge');
}
class PhotoCache{
 constructor(o={}){this.o=o;this.fetch=o.fetch||((...args)=>fetch(...args));this.URL=o.URL||URL;this.items=new Map();this.context=null;}
 clear(){for(const item of this.items.values()){item.controller.abort();if(item.url)this.URL.revokeObjectURL(item.url);}this.items.clear();this.context=null;}
 get(ref){return this.items.get(ref)?.url||'';}
 sync(session,players=[]){
  if(!session){this.clear();return;}
  if(this.context?.token!==session.token||this.context?.server!==session.server){this.clear();this.context={token:session.token,server:session.server};}
  const context=this.context,wanted=new Set(players.map(p=>p.photo).filter(id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id)));
  for(const [ref,item]of this.items)if(!wanted.has(ref)){item.controller.abort();if(item.url)this.URL.revokeObjectURL(item.url);this.items.delete(ref);}
  for(const ref of wanted){const old=this.items.get(ref);if(old&&(!old.failed||Date.now()-old.at<15000))continue;
   const item={controller:new AbortController(),at:Date.now(),failed:false,url:''};this.items.set(ref,item);
   const timeout=setTimeout(()=>item.controller.abort(),10000);
   this.fetch(context.server+'/api/photo/'+ref,{headers:{Authorization:'Bearer '+context.token},signal:item.controller.signal}).then(async res=>{
    if(!res.ok||res.headers.get('content-type')?.split(';')[0]!=='image/jpeg')throw Error('photoGone');
    const blob=await res.blob();if(!blob.size||blob.size>MAX_BYTES)throw Error('photoFormat');
    if(this.context!==context||this.items.get(ref)!==item)return;
    item.url=this.URL.createObjectURL(blob);this.o.onChange?.();
   }).catch(()=>{if(this.items.get(ref)===item)item.failed=true;}).finally(()=>clearTimeout(timeout));
  }
 }
}
return {prepare,validDataURL,PhotoCache,SIZE,MAX_BYTES,MAX_FILE};
});
