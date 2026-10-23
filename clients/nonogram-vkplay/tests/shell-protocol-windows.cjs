'use strict';
// An isolated Windows protocol HANDLER, not Game Center and not a payment server.
// No HTTP is performed. Refuse to replace any existing vkplay registration.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const assert=require('node:assert/strict');
const {execFileSync,spawnSync}=require('node:child_process');
async function verifyShellProtocol(running,root,report) {
  const existing=spawnSync('reg.exe',['query','HKCR\\vkplay'],{encoding:'utf8'});
  assert.equal(existing.status,1,'Run on a clean Windows test machine: do not replace an installed VK Play handler');
  const key='HKCU\\Software\\Classes\\vkplay';
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'nonogram protocol '));
  const output=path.join(temp,'received.json');
  const python=execFileSync('python',['-c','import sys;print(sys.executable)'],{encoding:'utf8'}).trim();
  const capture=path.join(root,'tests','capture_protocol.py');
  const command=`"${python}" "${capture}" "${output}" "%1"`;
  let registered=false;
  try {
    execFileSync('reg.exe',['add',key,'/ve','/d','URL:Nonogram isolated test','/f'],{stdio:'pipe'});
    registered=true;
    execFileSync('reg.exe',['add',key,'/v','URL Protocol','/d','','/f'],{stdio:'pipe'});
    execFileSync('reg.exe',['add',key+'\\shell\\open\\command','/ve','/d',command,'/f'],{stdio:'pipe'});
    const payment='https://co.vkpay.ru/test?order=local%2F123&sign=a%2Bb+z&return_url=https%3A%2F%2Fvkplay.ru%2F';
    const result=await running.evaluate(async({app,shell},url)=>{
      const req=process.getBuiltinModule('module').createRequire(app.getAppPath()+'/package.json');
      const logs=[];
      const bridge=req('./desktop/overlay.cjs').createOverlay({releaseConfigured:true,
        backendUrl:'https://example.test/',gcid:'0.2046788',paymentHosts:['vkplay.ru','co.vkpay.ru']},
        {openExternal:(uri,options)=>shell.openExternal(uri,options),log:e=>logs.push(e)});
      return {result:await bridge.open(url),logs};
    },payment);
    assert.deepEqual(result.result,{ok:true,submitted:true,visible:null});
    const deadline=Date.now()+10000;
    while(!fs.existsSync(output)&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,100));
    assert(fs.existsSync(output),'Windows must actually deliver the command to the local handler');
    const received=JSON.parse(fs.readFileSync(output,'utf8'));
    assert.equal(received.length,1,'URI must arrive as one argument');
    const uri=new URL(received[0]);
    assert.equal(uri.protocol,'vkplay:');assert.equal(uri.hostname,'demandbrowserform');
    assert.equal(uri.pathname,'/0.2046788/');assert.equal(uri.searchParams.get('url'),payment);
    assert.equal(uri.searchParams.get('width'),'80%');assert.equal(uri.searchParams.get('height'),'80%');
    assert.equal(uri.searchParams.get('caption'),'Нонограммы — Мир пикселей');
    assert.deepEqual(result.logs.map(x=>x.event),['requested','submitted']);
    assert(!JSON.stringify(result.logs).includes('local%2F123'));
    report.shellProtocolDispatchTested=true;
    report.checks.push('Packaged EXE: real Windows ShellExecuteEx dispatch to isolated local vkplay handler; exact nested URL and dimensions preserved; Game Center/payment NOT tested');
  } finally {
    if(registered)execFileSync('reg.exe',['delete',key,'/f'],{stdio:'pipe'});
    fs.rmSync(temp,{recursive:true,force:true});
  }
}
module.exports={verifyShellProtocol};
