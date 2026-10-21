"""Local Windows test handler. Capture argv only; never fetch or open a URL."""
import json
import os
import sys
from pathlib import Path

output = Path(sys.argv[1])
partial = output.with_suffix('.tmp')
partial.write_text(json.dumps(sys.argv[2:]), encoding='utf-8')
os.replace(partial, output)
