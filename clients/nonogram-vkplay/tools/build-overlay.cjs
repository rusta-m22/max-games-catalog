'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),version=require('../package.json').devDependencies.electron;
if(process.platform!=='win32'||process.arch!=='x64')throw new Error('WINDOWS_X64_BUILD_REQUIRED');
const binary=path.join(root,'native/build/Release/vkplay_overlay.node');
const stamp=path.join(root,'native/build/source-key.txt');
const digest=crypto.createHash('sha256').update(version).update('node-gyp@13.1.0');
for(const name of ['native/gclay.cc','native/binding.gyp','tests/native/fake-gclay.cc'])
  digest.update(fs.readFileSync(path.join(root,name)));
const key=digest.digest('hex');
if(!fs.existsSync(binary)||!fs.existsSync(stamp)||fs.readFileSync(stamp,'utf8')!==key) {
  // npm exec pins the build tool, downloads Electron's matching headers and verifies npm integrity.
  // npm run supplies npm_execpath; no shell command interpolation and no credentials are needed.
  const npm=process.env.npm_execpath;
  if(!npm||!fs.existsSync(npm))throw new Error('RUN_WITH_NPM_RUN_BUILD_WIN');
  execFileSync(process.execPath,[npm,'exec','--yes','--package=node-gyp@13.1.0','--',
    'node-gyp','rebuild','--directory',path.join(root,'native'),
    '--target='+version,'--arch=x64','--dist-url=https://electronjs.org/headers'],
    {cwd:root,stdio:'inherit'});
  fs.writeFileSync(stamp,key);
}
fs.copyFileSync(binary,path.join(root,'desktop/vkplay_overlay.node'));
