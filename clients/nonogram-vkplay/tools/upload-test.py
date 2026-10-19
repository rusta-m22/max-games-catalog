"""VK Play's documented bstool protocol. This wrapper supports Test uploads only."""
import argparse,hashlib,json,os,re,subprocess,sys,urllib.request,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
TOOLS_URL='https://static.gc.vkplay.ru/guptools/linux.zip'
TOOLS_SHA256='40b9963c8635855529dbe30a5197c1668f3847b721747c4a5d04aaecc18bd8e0'


def validate_source(source):
    source=Path(source).resolve()
    config=json.loads((source/'resources/app/desktop/config.json').read_text())
    build=json.loads((source/'BUILD-INFO.json').read_text())
    if config.get('releaseConfigured') is not True or build.get('releaseConfigured') is not True:
        raise ValueError('Configure and rebuild the client before a Test upload')
    files=[p for p in source.rglob('*') if p.is_file()]
    if not files or len(files)>1000:raise ValueError('VK Play file limit exceeded')
    for p in source.rglob('*'):
        rel=p.relative_to(source).as_posix()
        if p.is_symlink() or not rel.isascii() or len(rel)>180:
            raise ValueError('Invalid distribution path')
    checks=json.loads((source/'FILES-SHA256.json').read_text())
    expected=set()
    for check in checks:
        p=(source/check['path']).resolve()
        if not p.is_relative_to(source) or not p.is_file():raise ValueError('Invalid checksum path')
        expected.add(p)
        if p.stat().st_size!=check['bytes'] or hashlib.sha256(p.read_bytes()).hexdigest()!=check['sha256']:
            raise ValueError('Distribution hash mismatch')
    if expected!={p.resolve() for p in files if p.name!='FILES-SHA256.json'}:
        raise ValueError('Distribution file list mismatch')
    if not (source/'Nonogram.exe').is_file():raise ValueError('Nonogram.exe is missing')
    return str(build['version'])


def command(tool_dir,assembly,source,token,version):
    # No passthrough flags, removal commands, or move-to-Live command are accepted.
    return [str(Path(tool_dir).resolve()/'bstool'),str(Path(assembly).resolve()),
            '-src='+str(Path(source).resolve()),'-token='+token,'-versioninfo='+version]


def redact(value,token):
    value=value.replace(token,'[REDACTED]') if token else value
    value=re.sub(r'(?i)(-token=|[?&]sign=)[^\s&]+',r'\1[REDACTED]',value)
    return value


def install_tools(directory):
    directory=Path(directory).resolve()
    directory.mkdir(parents=True,exist_ok=True,mode=0o700)
    archive=directory/'official-tools.zip'
    with urllib.request.urlopen(TOOLS_URL,timeout=60) as response:
        data=response.read(50*1024*1024+1)
    if hashlib.sha256(data).hexdigest()!=TOOLS_SHA256:
        raise ValueError('Official tools changed; review and update the pinned SHA-256 before uploading')
    archive.write_bytes(data)
    with zipfile.ZipFile(archive) as z:
        if z.testzip():raise ValueError('Corrupt official tools archive')
        for entry in z.infolist():
            target=(directory/entry.filename).resolve()
            if not target.is_relative_to(directory):raise ValueError('Invalid official tools archive path')
        z.extractall(directory)
    for name in ('bstool','gupupd','CreateDiff','CreateDistrib','PXDUtil'):
        (directory/name).chmod(0o700)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--source',type=Path,default=ROOT/'dist/Nonogram-VKPlay-win-x64')
    parser.add_argument('--assembly',type=Path,default=ROOT/'vendor/assembly')
    parser.add_argument('--tool-dir',type=Path,default=ROOT/'vendor/guptools-linux')
    parser.add_argument('--execute',action='store_true',help='Upload the configured client to Test')
    args=parser.parse_args()
    version=validate_source(args.source)
    if args.assembly.resolve().is_relative_to(args.source.resolve()):
        raise ValueError('Assembly directory must be outside the source distribution')
    if not args.execute:
        print(json.dumps({'mode':'DRY RUN; no network or upload',
            'command':command(args.tool_dir,args.assembly,args.source,'[PROTECTED SECRET]',version),
            'target':'Test','livePromotionSupported':False},indent=2))
        return 0
    if sys.platform!='linux':raise ValueError('Automated uploader requires Linux x64; use GameCenterUploader on Windows')
    token=os.environ.get('VKPLAY_BUILD_TOKEN','')
    if not 16<=len(token)<=4096 or re.search(r'[\s\x00]',token):
        raise ValueError('Set VKPLAY_BUILD_TOKEN in a protected secret store, not in command arguments')
    # Always fetch and checksum the official release; do not run a replaced local tool.
    install_tools(args.tool_dir)
    args.assembly.mkdir(parents=True,exist_ok=True,mode=0o700)
    child_env={k:v for k,v in os.environ.items() if k!='VKPLAY_BUILD_TOKEN'}
    proc=subprocess.Popen(command(args.tool_dir,args.assembly,args.source,token,version),
        cwd=args.tool_dir,env=child_env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,errors='replace')
    try:output,_=proc.communicate(timeout=5400)
    except subprocess.TimeoutExpired:
        proc.kill();output,_=proc.communicate()
        print(redact(output,token));raise ValueError('Test upload timed out; inspect Test before retrying') from None
    print(redact(output,token))
    if proc.returncode:raise ValueError('bstool failed; Test upload is not confirmed')
    print('bstool completed. Verify the new build under Distributions / Test in the developer dashboard.')
    return 0


if __name__=='__main__':
    try:raise SystemExit(main())
    except (ValueError,OSError,KeyError,json.JSONDecodeError) as error:
        print(str(error),file=sys.stderr);raise SystemExit(1) from None
