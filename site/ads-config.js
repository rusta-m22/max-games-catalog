// One central configuration. MAX is hard-disabled inside the module as well.
window.JARVIS_ADS_CONFIG=Object.freeze({
  platform:'auto',
  // Set to your own HTTPS origin + /shared/ads/ for separately hosted builds.
  moduleBase:'',
  enabled:true,
  interstitialCooldownMs:90000,
  requestTimeoutMs:120000,
  sdkTimeoutMs:7000,
  maxEnabled:false,
  vkBridgeURL:'',
});
