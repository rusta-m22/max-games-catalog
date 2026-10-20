'use strict';
// Only public values are accepted; no secret belongs in a client configuration.
const fs=require('node:fs'),path=require('node:path');
const {checkConfig}=require('../desktop/platform-core.cjs');
const args=process.argv.slice(2), flags={};
for (let i=0;i<args.length;i+=2) {
  if (!['--backend','--gcid'].includes(args[i]) || !args[i+1] || flags[args[i]]) {
    console.error('Usage: npm run configure -- --backend https://YOUR-BACKEND/ --gcid 0.YOURID');
    process.exit(1);
  }
  flags[args[i]]=args[i+1];
}
const backendUrl=flags['--backend']||process.env.VKPLAY_BACKEND_URL;
const gcid=flags['--gcid']||process.env.VKPLAY_GCID;
try {
  const config={backendUrl,gcid,paymentHosts:['vkplay.ru','co.vkpay.ru'],releaseConfigured:true};
  checkConfig(config);
  fs.writeFileSync(path.join(__dirname,'../desktop/config.json'),JSON.stringify(config,null,2)+'\n');
  console.log('Public client configuration saved. Rebuild the client before uploading.');
} catch (_) {console.error('Provide a valid HTTPS backend origin and GCID. No secret values are accepted.');process.exit(1);}
