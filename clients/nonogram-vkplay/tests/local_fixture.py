"""Local test fixture; no external VK Play traffic."""
import json,sys,tempfile
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
from app import Handler,Store
from vkplay import VKPlay
SECRET='local-test-secret-not-a-credential'
UPSTREAM={'timeout':False}
def transport(method,url,data=None):
 if '/gas?' in url:return {'status':'ok'}
 if UPSTREAM['timeout']:raise TimeoutError('local fixture checkout timeout')
 return {'status':'ok','url':'https://co.vkpay.ru/test-only-checkout?order=fixture%2F123&lang=ru'}
class FixtureHandler(Handler):
 def do_POST(self):
  if self.path!='/test/checkout-mode':return super().do_POST()
  value=json.loads(self.rfile.read(int(self.headers.get('Content-Length','0'))))
  UPSTREAM['timeout']=value.get('timeout') is True
  self.send({'ok':True})
 def do_GET(self):
  if self.path!='/test/orders':return super().do_GET()
  with self.store.lock:
   orders=[dict(row) for row in self.store.db.execute('SELECT id,request_id,product,status FROM vk_orders')]
  self.send({'orders':orders})
with tempfile.TemporaryDirectory() as d:
 Handler.store=Store(str(Path(d)/'fixture.db'),VKPlay('12345',SECRET,transport),True)
 server=ThreadingHTTPServer(('127.0.0.1',0),FixtureHandler)
 print(json.dumps({'port':server.server_port}),flush=True);server.serve_forever()
