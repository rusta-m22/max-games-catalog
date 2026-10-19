'use strict';
const {spawnSync}=require('node:child_process');
for(const [binary,args]of [
  [process.platform==='win32'?'python':'python3',['-m','unittest','discover','-s','tests','-p','test_*.py','-v']],
  [process.execPath,['--test','tests/desktop.test.cjs','tests/content.test.cjs']],
]) {
  const r=spawnSync(binary,args,{stdio:'inherit'});
  if(r.error||r.status!==0)process.exit(r.status||1);
}
