'use strict';
const {overlayUrl}=require('./platform-core.cjs');
// The main process owns this bridge. No arbitrary native path or API is exposed to the renderer.
function createOverlay(config,{platform=process.platform,load=()=>require('./vkplay_overlay.node')}={}) {
  let native, last={available:false,error:'OVERLAY_NOT_LOADED'};
  function initialize() {
    if(platform!=='win32')return last={available:false,error:'OVERLAY_UNSUPPORTED_PLATFORM'};
    try { native ||= load(); return last=native.initialize(); }
    catch (_) { return last={available:false,error:'OVERLAY_BRIDGE_UNAVAILABLE'}; }
  }
  function status() {
    if(!native)return last;
    try { return last=native.status(); }
    catch (_) { return last={available:false,error:'OVERLAY_BRIDGE_UNAVAILABLE'}; }
  }
  function open(url) {
    // Reuse the existing exact HTTPS origin validation, without opening a shell protocol.
    if(typeof url!=='string'||/[\u0000-\u0020\u007f]/.test(url))throw new Error('INVALID_PAYMENT_URL');
    overlayUrl(url,config);
    if(!native||!last.available)initialize();
    if(!last.available)return {ok:false,error:last.error};
    try {
      last=native.open(url);
      return last.accepted ? {ok:true,visible:last.overlayState===1} :
        {ok:false,error:last.error||'OVERLAY_FORM_REJECTED'};
    } catch (_) { return {ok:false,error:'OVERLAY_BRIDGE_UNAVAILABLE'}; }
  }
  return {initialize,status,open};
}
module.exports={createOverlay};
