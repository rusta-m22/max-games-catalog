"""Package the standalone backend and refresh source ZIP; never rebuild the client."""
import hashlib
import json
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent / 'deliverables'
OUT.mkdir(exist_ok=True)
DOTFILES = {'.dockerignore', '.gitignore', '.env.example'}


def include(path):
    parts = path.relative_to(ROOT).parts
    return (path.is_file() and not any(p in {'node_modules', '__pycache__', 'dist', 'data', 'backups'} for p in parts)
            and not any(p.startswith('.') and p not in DOTFILES for p in parts)
            and path.suffix not in {'.pyc', '.sqlite3', '.db'}
            and path.name not in {'browser-install.txt', 'packaging-log.txt'})


def archive(path, entries):
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED, compresslevel=6) as output:
        for source, target in entries:
            output.write(source, target)
    with zipfile.ZipFile(path) as result:
        assert result.testzip() is None
        assert len(result.namelist()) == len(set(result.namelist()))
    return {'file': path.name, 'bytes': path.stat().st_size,
            'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'crcVerified': True}


if __name__ == '__main__':
    prefix = 'Nonogram-VKPlay-Server/'
    entries = [(p, prefix + p.relative_to(ROOT / 'server').as_posix()) for p in sorted((ROOT / 'server').rglob('*')) if include(p)]
    for name in ('test_payments.py', 'test_deployment.py'):
        entries.append((ROOT / 'tests' / name, prefix + 'tests/' + name))
    for name in ('SANDBOX-CHECKLIST.md', 'SERVER-STATUS-RU.md'):
        entries.append((ROOT / 'docs' / name, prefix + name))
    entries.append((ROOT / 'evidence/server-release-tests.txt', prefix + 'evidence/local-tests.txt'))
    server = archive(OUT / 'Nonogram-VKPlay-Server-Amvera.zip', entries)
    files = []
    for folder in ('game', 'desktop', 'server', 'tests', 'docs', 'tools', 'evidence'):
        files.extend(p for p in (ROOT / folder).rglob('*') if include(p))
    files.extend(ROOT / name for name in ('README.md', 'package.json', 'package-lock.json'))
    source = archive(OUT / 'Nonogram-VKPlay-Source-and-Backend.zip',
                     [(p, 'Nonogram-VKPlay-Source/' + p.relative_to(ROOT).as_posix()) for p in sorted(files)])
    result = {'backendVersion': '3.1.1', 'clientVersion': '3.1.0', 'archives': [server, source],
              'realVKPlaySandboxTested': False, 'deployed': False, 'dockerBuildTested': False}
    (OUT / 'server-packaging.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))
