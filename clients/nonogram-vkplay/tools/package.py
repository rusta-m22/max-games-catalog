"""Archive the built client, checking hashes, paths and VK Play's file limit."""
import hashlib,json,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/'dist/Nonogram-VKPlay-win-x64'
OUT=ROOT/'deliverables'
OUT.mkdir(exist_ok=True)
version=json.loads((ROOT/'package.json').read_text())['version']
files=sorted(p for p in SOURCE.rglob('*') if p.is_file() and not any(s.startswith('.') for s in p.relative_to(SOURCE).parts))
assert files and len(files)<=1000
for item in json.loads((SOURCE/'FILES-SHA256.json').read_text()):
    p=SOURCE/item['path']
    assert p.stat().st_size==item['bytes']
    assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256']
archive=OUT/f'Nonogram-VKPlay-Windows-x64-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for p in files:
        rel=p.relative_to(SOURCE).as_posix()
        assert rel.isascii() and len(rel)<=180 and not p.is_symlink()
        z.write(p,'Nonogram-VKPlay-win-x64/'+rel)
with zipfile.ZipFile(archive) as z: assert z.testzip() is None
manifest={'file':archive.name,'bytes':archive.stat().st_size,
    'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'crcVerified':True,
    'fileCount':len(files),'build':json.loads((SOURCE/'BUILD-INFO.json').read_text())}
(OUT/'packaging.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps(manifest,indent=2))
