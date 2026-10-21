'use strict';
// A real packaged EXE on Windows. This does not simulate Game Center or payments.
const { _electron:electron }=require('playwright');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const {verifyShellProtocol}=require('./shell-protocol-windows.cjs');
const executablePath=process.env.NONOGRAM_EXE||path.join(root,'dist/Nonogram-VKPlay-win-x64/Nonogram.exe');
const report={environment:'Packaged Windows application; no real VK Play requests',
  platform:process.platform,windows:os.release(),checks:[],errors:[],passed:false,
  realVKPlaySandboxTested:false,realGameCenterOverlayTested:false};
let running;
async function open(args=[]) {
  running=await electron.launch({executablePath,args,timeout:45000});
  const page=await running.firstWindow();
  page.on('pageerror',e=>report.errors.push(e.message));
  return page;
}
async function ready(page) {
  await page.waitForFunction(()=>window.Platform?.uiReady&&window.Game,{timeout:30000});
}
(async()=>{
  assert.equal(process.platform,'win32','This test must run on real Windows, not Wine or a browser');
  report.exeSHA256=crypto.createHash('sha256').update(fs.readFileSync(executablePath)).digest('hex');
  const configured=JSON.parse(fs.readFileSync(path.join(path.dirname(executablePath),'resources/app/desktop/config.json'))).releaseConfigured;
  try {
    // Direct launch must never bypass Game Center authentication.
    let page=await open();
    await page.locator('#message').waitFor({state:'visible'});
    const guard=await page.evaluate(()=>Native.bootstrap());
    assert.equal(guard.ready,false);
    assert.equal(guard.error,configured?'START_FROM_GAME_CENTER':'BUILD_NOT_CONFIGURED');
    await verifyShellProtocol(running,root,report);
    await running.close(); running=null;
    report.checks.push('Direct EXE launch is guarded; purchases cannot bypass authorization');
    if (configured) {
      page=await open(['--preview']);
      await page.locator('#message').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>Native.bootstrap().ready),false);
      report.checks.push('Preview flag cannot bypass a configured release');
      await running.close();running=null;
    } else {
      page=await open(['--preview']);await ready(page);
      const boot=await page.evaluate(()=>Native.bootstrap());
      assert(boot.ready&&boot.preview&&!boot.authorized);
      assert.equal(await page.evaluate(()=>typeof require),'undefined');
      const secure=await running.evaluate(({app,safeStorage})=>({packaged:app.isPackaged,
        encrypted:safeStorage.isEncryptionAvailable(),
        roundtrip:safeStorage.decryptString(safeStorage.encryptString('native-test'))==='native-test'}));
      assert.deepEqual(secure,{packaged:true,encrypted:true,roundtrip:true});
      report.checks.push('Packaged EXE boots; isolated renderer and Windows DPAPI roundtrip pass');
      const count=await page.evaluate(()=>({levels:NONO_DATA.levels.length,worlds:NONO_DATA.worlds.length}));
      assert.deepEqual(count,{levels:507,worlds:10});
      if(await page.locator('#modal-root [data-action="close"]').count())
        await page.locator('#modal-root [data-action="close"]').first().click();
      await page.evaluate(()=>Game.start('w1-1',true));
      if(await page.locator('#modal-root [data-action="close"]').count())
        await page.locator('#modal-root [data-action="close"]').first().click();
      const cells=await page.evaluate(()=>{const b=Game.board;return Array.from(b.q.grid,Number)
        .map((v,i)=>({v,x:b.gx+(i%b.p.n+.5)*b.cell,y:b.gy+(Math.floor(i/b.p.n)+.5)*b.cell})).filter(c=>c.v>0);});
      const box=await page.locator('#board').boundingBox();
      for(const c of cells)await page.mouse.click(box.x+c.x,box.y+c.y);
      await page.waitForFunction(()=>Game.board?.won&&Game.state.done['w1-1']);
      await page.locator('[data-action="after-win"]').waitFor({state:'visible'});
      report.checks.push('First puzzle solved through native mouse input; completion and reward recorded');
      await page.locator('[data-action="after-win"]').click();
      await page.locator('.sidebar [data-target="shop"]').click();
      assert.equal(await page.locator('[data-action="eco-product"]:enabled').count(),0);
      const before=await page.evaluate(()=>({coins:Game.state.coins,hints:Game.state.hints}));
      await page.locator('[data-action="eco-buy"][data-id="hint_cell"]').click();
      await page.waitForFunction(n=>Game.state.hints===n,before.hints+1);
      const expected=await page.evaluate(()=>{
        Game.state.settings.lang='en';Game.applySettings();Game.navigate('shop');Game.save(true);
        return {coins:Game.state.coins,hints:Game.state.hints};
      });
      assert.equal(expected.coins,before.coins-30);
      assert((await page.locator('body').innerText()).includes('Open VK Play checkout'));
      await page.screenshot({path:path.join(root,'evidence/native-windows-shop.png')});
      await running.close();running=null;
      page=await open(['--preview']);await ready(page);
      const restored=await page.evaluate(()=>({coins:Game.state.coins,hints:Game.state.hints,
        completed:!!Game.state.done['w1-1'],language:Game.lang}));
      assert.deepEqual(restored,{...expected,completed:true,language:'en'});
      report.checks.push('Hint purchase, RU/EN, disabled real-money checkout and restart persistence pass');
      await running.close();running=null;
    }
    assert.deepEqual(report.errors,[]);report.passed=true;
  } finally {
    if(running)await running.close();
    fs.writeFileSync(path.join(root,'evidence/native-windows-report.json'),JSON.stringify(report,null,2)+'\n');
  }
  console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
