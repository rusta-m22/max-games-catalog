'use strict';
const products=new Set(['coins_500','coins_1200','coins_3000','coins_7000','starter']);
function createCheckout({api,overlay,log=()=>{}}) {
 let busy=false;
 function record(product,event,details={}) {
  // Product IDs are public. Never log request/order IDs, signed URLs or exceptions.
  try {log({product,event,...details});} catch (_) {}
 }
 function safeError(value) {return typeof value==='string'&&/^[A-Z_]{3,64}$/.test(value)?value:'SERVICE_UNAVAILABLE';}
 return async function checkout(product,requestId,checkOnly=false) {
  if(!products.has(product)||typeof requestId!=='string'||!/^[A-Za-z0-9_-]{8,100}$/.test(requestId))return {ok:false,status:400,error:'INVALID_PRODUCT'};
  if(busy)return {ok:false,status:409,error:'PAYMENT_UNAVAILABLE'};
  busy=true;
  try {
   record(product,checkOnly?'order_recheck':'order_requested');
   const r=await api('/api/vkplay/order',{product,requestId});
   if(!r.ok){record(product,'order_failed',{error:safeError(r.error),status:Number.isInteger(r.status)?r.status:503});return r;}
   if(r.value.status==='paid'){record(product,'order_paid');return {ok:true,value:{orderId:r.value.orderId,status:'paid'}};}
   // An explicit new attempt first checks the old order WITHOUT reopening its URL.
   if(checkOnly){record(product,'order_unpaid');return {ok:true,value:{orderId:r.value.orderId,status:r.value.status}};}
   const opened=await overlay.open(r.value.paymentUrl);
   if(!opened.ok){record(product,'checkout_failed',{error:safeError(opened.error)});return {ok:false,status:503,error:opened.error};}
   record(product,'checkout_submitted');
   return {ok:true,value:{orderId:r.value.orderId,status:r.value.status,overlaySubmitted:opened.submitted}};
  } catch (_) {record(product,'checkout_failed',{error:'OVERLAY_UNAVAILABLE'});return {ok:false,status:503,error:'OVERLAY_UNAVAILABLE'};}
  finally {busy=false;}
 };
}
module.exports={createCheckout};
