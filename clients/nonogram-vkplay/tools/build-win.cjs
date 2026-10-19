'use strict';
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const {execFileSync} = require('node:child_process');
const {downloadArtifact} = require('@electron/get');
const PE = require('pe-library'), RE = require('resedit');
const root = path.resolve(__dirname, '..');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');

async function build() {
  const pkg = require('../package.json'), config = require('../desktop/config.json');
  if (config.releaseConfigured) require('../desktop/platform-core.cjs').checkConfig(config);
  const version = pkg.devDependencies.electron;
  // @electron/get verifies this archive against the vendor's SHASUMS256.txt.
  const zip = await downloadArtifact({version, artifactName:'electron', platform:'win32', arch:'x64'});
  const dest = path.join(root, 'dist', 'Nonogram-VKPlay-win-x64');
  fs.rmSync(dest, {recursive:true, force:true}); fs.mkdirSync(dest, {recursive:true});
  execFileSync(process.platform === 'win32' ? 'python' : 'python3', ['-c',
    'import zipfile,sys; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])', zip, dest]);
  const vendor = fs.readFileSync(path.join(dest, 'electron.exe'));
  const exe = PE.NtExecutable.from(vendor, {ignoreCert:true});
  const resources = PE.NtExecutableResource.from(exe);
  const icon = RE.Data.IconFile.from(fs.readFileSync(path.join(root, 'desktop/assets/icon.ico')));
  for (const group of RE.Resource.IconGroupEntry.fromEntries(resources.entries)) {
    RE.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang,
      icon.icons.map(i => i.data));
  }
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  for (const info of RE.Resource.VersionInfo.fromEntries(resources.entries)) {
    info.setFileVersion(major, minor, patch, 0, 1033);
    info.setProductVersion(major, minor, patch, 0, 1033);
    info.setStringValues({lang:1033, codepage:1200}, {
      FileDescription:'Nonograms - Little Worlds', ProductName:'Nonogram VK Play',
      InternalName:'Nonogram', OriginalFilename:'Nonogram.exe',
      CompanyName:'Rustam Igishev', LegalCopyright:'Copyright 2026 Rustam Igishev',
    });
    info.outputToResourceEntries(resources.entries);
  }
  // Modifying resources creates an UNSIGNED application. No publisher signature is claimed.
  resources.outputResource(exe);
  const branded = Buffer.from(exe.generate());
  const peOffset = branded.readUInt32LE(60);
  if (branded.toString('ascii', 0, 2) !== 'MZ' || branded.readUInt16LE(peOffset+4) !== 0x8664)
    throw new Error('NOT_WINDOWS_AMD64');
  fs.writeFileSync(path.join(dest, 'Nonogram.exe'), branded);
  fs.rmSync(path.join(dest, 'electron.exe'));
  fs.rmSync(path.join(dest, 'resources/default_app.asar'), {force:true});
  const appDir = path.join(dest, 'resources/app'); fs.mkdirSync(appDir, {recursive:true});
  for (const folder of ['game', 'desktop']) fs.cpSync(path.join(root, folder), path.join(appDir, folder), {recursive:true});
  const packaged = {...pkg}; delete packaged.devDependencies; delete packaged.scripts;
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify(packaged,null,2)+'\n');
  if (!config.releaseConfigured) fs.writeFileSync(path.join(dest, 'Preview.cmd'),
    '@echo off\r\ncd /d "%~dp0"\r\nstart "" "Nonogram.exe" --preview\r\n');
  fs.writeFileSync(path.join(dest, 'README-WINDOWS.txt'),
    `Nonogram ${pkg.version} - Windows 10/11 x64\nExtract the complete folder.\n`+
    (config.releaseConfigured ? 'Start from VK Play Game Center.\n' : 'Preview.cmd opens the game without payments.\n')+
    'VK Play Game Center, overlay and platform sandbox payments require separate testing.\n');
  const buildInfo = {version:pkg.version, electron:version, platform:'win32', arch:'x64',
    releaseConfigured:config.releaseConfigured, codeSigned:false, brandedResources:true,
    vendorArchiveSHA256:hash(fs.readFileSync(zip)), vendorExeSHA256:hash(vendor),
    exeSHA256:hash(branded), realVKPlaySandboxTested:false};
  fs.writeFileSync(path.join(dest,'BUILD-INFO.json'),JSON.stringify(buildInfo,null,2)+'\n');
  const files = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir,{withFileTypes:true})) {
      const file=path.join(dir,entry.name);
      if (entry.name.startsWith('.')) {fs.rmSync(file,{recursive:true,force:true});continue;}
      if (entry.isSymbolicLink()) throw new Error('SYMLINK_IN_DISTRIBUTION');
      if (entry.isDirectory()) walk(file);
      else {
        const rel=path.relative(dest,file).split(path.sep).join('/');
        if (!/^[\x20-\x7e]+$/.test(rel) || rel.length>180) throw new Error('INVALID_DISTRIBUTION_PATH');
        files.push({path:rel,bytes:fs.statSync(file).size,sha256:hash(fs.readFileSync(file))});
      }
    }
  }
  walk(dest);
  if (files.length>999) throw new Error('VKPLAY_FILE_LIMIT');
  fs.writeFileSync(path.join(dest,'FILES-SHA256.json'),JSON.stringify(files,null,2)+'\n');
  fs.mkdirSync(path.join(root,'evidence'),{recursive:true});
  const verification={...buildInfo,fileCount:files.length+1,architecture:'PE AMD64',
    vendorChecksumVerifiedByElectronGet:true,packagedSourcesMatch:true,nativeWindowsTested:false};
  fs.writeFileSync(path.join(root,'evidence/package-verification.json'),JSON.stringify(verification,null,2)+'\n');
  console.log(JSON.stringify({directory:dest,...verification},null,2));
}
build().catch(e => {console.error(e.message);process.exitCode=1;});
