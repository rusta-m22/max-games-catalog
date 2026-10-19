"""Local test fixture; no external VK Play traffic."""
import json,sys,tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from app import Handler,Store
from vkplay import VKPlay
SECRET='local-test-secret-not-a-credential'
def transport(method,url,data=None):return {'status':'ok'} if '/gas?' in url else {'status':'ok','url':'https://vkplay.ru/test-only-checkout'}
with tempfile.TemporaryDirectory() as d:
 Handler.store=Store(str(Path(d)/'fixture.db'),VKPlay('12345',SECRET,transport),True)
 server=ThreadingHTTPServer(('127.0.0.1',0),Handler)
 print(json.dumps({'port':server.server_port}),flush=True);server.serve_forever()
