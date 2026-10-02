"""Update only the plaintext bridge in the supplied Godot 4 PCK; keep other entries unchanged."""
from pathlib import Path
import hashlib
import struct

root = Path(__file__).resolve().parent.parent
pack = root / 'site/games/bumbila/index.pck'
b = bytearray(pack.read_bytes())
if b[:4] != b'GDPC' or struct.unpack_from('<I', b, 4)[0] != 4:
    raise SystemExit('Unsupported PCK format; nothing changed')
base, directory = struct.unpack_from('<QQ', b, 24)
count = struct.unpack_from('<I', b, directory)[0]
p = directory + 4
entries = []
for _ in range(count):
    length = struct.unpack_from('<I', b, p)[0]; p += 4
    name = bytes(b[p:p+length]).rstrip(b'\0').decode(); p += length
    offset, size = struct.unpack_from('<QQ', b, p)
    entries.append((name, offset, size, p))
    p += 36
name, offset, old_size, record = next(e for e in entries if e[0] == 'platform_bridge.gd')
if any(off > offset for _, off, _, _ in entries):
    raise SystemExit('Bridge is not the final resource; nothing changed')
payload = (root / 'integration/bumbila_platform_bridge.gd').read_bytes()
new_data = b[:base+offset] + payload
new_data.extend(b'\0' * (-len(new_data) % 16))
new_directory = len(new_data)
index = b[directory:]
struct.pack_into('<Q', index, record-directory+8, len(payload))
index[record-directory+16:record-directory+32] = hashlib.md5(payload).digest()
new_data.extend(index)
struct.pack_into('<Q', new_data, 32, new_directory)
# Verify that every untouched resource is byte-for-byte identical.
for entry, off, size, _ in entries:
    if entry != name:
        assert b[base+off:base+off+size] == new_data[base+off:base+off+size]
pack.write_bytes(new_data)
platform = root / 'site/games/bumbila/platform.js'
import re
platform.write_text(re.sub(r"'index.pck':\d+", "'index.pck':"+str(len(new_data)), platform.read_text()))
print(f'Updated bridge; preserved {count-1} resources; PCK {len(new_data)} bytes')
