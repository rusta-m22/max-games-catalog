import {readFile,writeFile} from 'node:fs/promises';
const arg=process.argv[2];
if(!arg)throw Error('Usage: node scripts/configure-origin.mjs https://YOUR-DOMAIN');
const origin=new URL(arg);
if(origin.protocol!=='https:'||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('Expected a bare HTTPS origin, without credentials, query or path');
const file=new URL('../site/ads-config.js',import.meta.url);
const source=await readFile(file,'utf8');
await writeFile(file,source.replace(/moduleBase\s*:\s*(?:"[^"]*"|'[^']*')/,`moduleBase:${JSON.stringify(origin.origin+'/shared/ads/')}`));
console.log('Advertising module origin configured:',origin.origin+'/shared/ads/');
