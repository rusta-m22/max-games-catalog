"""Consistent SQLite backup; publish only a verified, complete copy."""
import argparse,os,sqlite3,tempfile
from pathlib import Path

def backup(source,destination):
 source,destination=Path(source).resolve(),Path(destination).resolve()
 if not source.is_file():raise ValueError('Source database does not exist')
 if source==destination or destination.exists():raise ValueError('Choose a new backup destination')
 destination.parent.mkdir(parents=True,exist_ok=True)
 fd,temporary=tempfile.mkstemp(prefix='.backup-',dir=destination.parent);os.close(fd)
 src=dst=None
 try:
  src=sqlite3.connect(source.as_uri()+'?mode=ro',uri=True);dst=sqlite3.connect(temporary)
  src.backup(dst,pages=256)
  if dst.execute('PRAGMA integrity_check').fetchone()[0]!='ok':raise ValueError('Backup integrity check failed')
  dst.close();dst=None
  with open(temporary,'rb') as completed:os.fsync(completed.fileno())
  os.link(temporary,destination) # Atomic; never overwrite an existing backup.
 finally:
  if src:src.close()
  if dst:dst.close()
  Path(temporary).unlink(missing_ok=True)
 return destination

if __name__=='__main__':
 p=argparse.ArgumentParser(description=__doc__);p.add_argument('destination');a=p.parse_args()
 try:print('Backup completed:',backup(Path(os.environ.get('DATA_DIR','./data'))/'vkplay.sqlite3',a.destination))
 except (ValueError,OSError,sqlite3.Error):raise SystemExit('Backup failed; check source, free space and destination permissions') from None
