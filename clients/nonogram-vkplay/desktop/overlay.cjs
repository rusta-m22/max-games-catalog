'use strict';
const {overlayUrl}=require('./platform-core.cjs');

// Main-process only. Electron's Windows implementation uses ShellExecuteExW.
// The renderer supplies a product ID; only the server may supply a checkout URL.
function createOverlay(config,{platform=process.platform,openExternal,log=()=>{}}={}) {
  const available=platform==='win32'&&typeof openExternal==='function';
  let last={available,method:'shell.openExternal',scheme:'vkplay',visible:null};
  function record(event,details={}) {
    // Never include the URL, query, user/order IDs, launch args or exception text.
    try {log({event,method:'shell.openExternal',scheme:'vkplay',...details});} catch (_) {}
  }
  async function open(url) {
    if(!available) {
      const error=platform==='win32'?'PAYMENT_LAUNCH_FAILED':'OVERLAY_UNSUPPORTED_PLATFORM';
      last={...last,submitted:false,error};
      return {ok:false,error};
    }
    let command;
    try {command=overlayUrl(url,config);} catch (e) {
      const error=['INVALID_PAYMENT_URL','UNEXPECTED_PAYMENT_HOST','PAYMENT_URL_TOO_LONG',
        'BUILD_NOT_CONFIGURED','INVALID_CONFIG'].includes(e.message)?e.message:'INVALID_PAYMENT_URL';
      last={...last,submitted:false,error};record('rejected',{error});
      return {ok:false,error};
    }
    const details={gcid:config.gcid,paymentHost:new URL(url).hostname};
    record('requested',details);
    try {
      await openExternal(command,{logUsage:true});
    } catch (_) {
      last={...last,submitted:false,error:'PAYMENT_LAUNCH_FAILED'};
      record('failed',{...details,error:last.error});
      return {ok:false,error:last.error};
    }
    // Windows accepting the command proves neither a visible form nor payment.
    last={available,method:'shell.openExternal',scheme:'vkplay',submitted:true,visible:null};
    record('submitted',details);
    return {ok:true,submitted:true,visible:null};
  }
  return {initialize:()=>({...last}),status:()=>({...last}),open};
}
module.exports={createOverlay};
