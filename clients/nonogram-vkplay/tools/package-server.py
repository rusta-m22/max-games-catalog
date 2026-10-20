"""Produce the standalone deployable backend from the current source version."""
import hashlib,json,re,zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'deliverables';OUT.mkdir(exist_ok=True)
match=re.search(r"^VERSION=['\"]([0-9]+\.[0-9]+\.[0-9]+)-vkplay-server['\"]$",(ROOT/'server/app.py').read_text(encoding='utf-8'),re.M)
if not match:raise ValueError('Missing backend version')
version=match.group(1)
entries=[]
for p in sorted((ROOT/'server').rglob('*')):
    if p.is_file() and '__pycache__' not in p.parts and p.suffix not in {'.pyc','.sqlite3','.db'} and p.name!='.env':
        entries.append((p,p.relative_to(ROOT/'server').as_posix()))
for name in ('test_payments.py','test_deployment.py','test_checkout_recovery.py','test_transport.py'):
    entries.append((ROOT/'tests'/name,'tests/'+name))
for name in ('SANDBOX-CHECKLIST.md','SERVER-STATUS-RU.md'):
    entries.append((ROOT/'docs'/name,name))
archive=OUT/f'Nonogram-VKPlay-Server-Amvera-{version}.zip'
with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for source,target in entries:z.write(source,'Nonogram-VKPlay-Server/'+target)
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    assert len(z.namelist())==len(set(z.namelist()))
result={'file':archive.name,'version':version,'bytes':archive.stat().st_size,
    'sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'crcVerified':True,
    'realVKPlaySandboxTested':False,'deployed':False}
(OUT/'server-packaging.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,indent=2))
