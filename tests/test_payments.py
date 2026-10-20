"""LOCAL contracts only: all VK Play upstream traffic is replaced by FakeTransport."""
import concurrent.futures,hashlib,json,sys,tempfile,unittest,threading,urllib.request,urllib.parse
from pathlib import Path
from http.server import ThreadingHTTPServer
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'server'))
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from app import Store,Handler,client_ip,PRODUCTS
from vkplay import VKPlay,sign,valid_signature
from economy_core import Error,LEVELS
SECRET='local-test-secret-not-a-credential'
class FakeTransport:
 def __init__(self):self.calls=[];self.fail=False;self.url='https://vkplay.ru/local-test-checkout'
 def __call__(self,method,url,data=None):
  self.calls.append((method,url,data))
  if self.fail:raise TimeoutError('simulated upstream timeout')
  return {'status':'ok'} if '/gas?' in url else {'status':'ok','url':self.url}
class Payments(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();self.path=str(Path(self.tmp.name)/'test.db');self.fake=FakeTransport();self.api=VKPlay('12345',SECRET,self.fake);self.store=Store(self.path,self.api,True);self.auth=self.store.auth_vk('42','test-otp-one','127.0.0.1')
 def tearDown(self):self.store.db.close();self.tmp.cleanup()
 def order(self,product='coins_500',request='request-one'):return self.store.order('42',product,request,'127.0.0.1')
 def receipt(self,order,tid='transaction-one',**changes):
  p={'uid':'42','sum':'99.00','tid':tid,'merchant_param':json.dumps({'uid':'42','item_id':'coins_500','additional_param':order['orderId']},separators=(',',':'))};p.update(changes);p['sign']=sign(p,SECRET);return p
 def balance(self):return self.store.wallet('42')['coins']
 def test_01_signature_sorted_raw_values(self):self.assertEqual(sign({'b':'one two','a':'x&y'},SECRET),hashlib.md5(('a=x&yb=one two'+SECRET).encode()).hexdigest())
 def test_02_signature_tampering(self):
  p={'a':'1'};p['sign']=sign(p,SECRET);self.assertTrue(valid_signature(p,SECRET));p['a']='2';self.assertFalse(valid_signature(p,SECRET))
 def test_03_gas_appid_only_in_signature(self):
  method,url,_=self.fake.calls[0];p={k:v[0] for k,v in urllib.parse.parse_qs(urllib.parse.urlsplit(url).query).items()};self.assertNotIn('appid',p);self.assertEqual(p['sign'],sign({**p,'appid':'12345'},SECRET));self.assertEqual(method,'GET')
 def test_04_billing_form_signed(self):
  self.order();method,url,params=self.fake.calls[-1];self.assertEqual(method,'POST');self.assertEqual(params['ids'],'1001');self.assertEqual(urllib.parse.parse_qs(urllib.parse.urlsplit(url).query)['sign'][0],sign(params,SECRET))
 def test_05_otp_once(self):
  with self.assertRaises(Error):self.store.auth_vk('42','test-otp-one','127.0.0.1')
  self.assertEqual(len(self.fake.calls),1)
 def test_06_otp_ambiguous_no_retry(self):
  self.fake.fail=True
  with self.assertRaises(TimeoutError):self.store.auth_vk('42','test-otp-two','127.0.0.1')
  with self.assertRaises(Error):self.store.auth_vk('42','test-otp-two','127.0.0.1')
  self.assertEqual(len(self.fake.calls),2)
 def test_07_sessions_hashed(self):
  self.assertEqual(self.store.authenticated(self.auth['token']),'42');stored=self.store.db.execute('SELECT token FROM sessions').fetchone()[0];self.assertNotEqual(stored,self.auth['token']);self.assertEqual(stored,hashlib.sha256(self.auth['token'].encode()).hexdigest())
 def test_08_invalid_uid(self):
  with self.assertRaises(Error):self.store.auth_vk('not-uid','test-otp-new','127.0.0.1')
 def test_09_invalid_otp(self):
  with self.assertRaises(Error):self.store.auth_vk('42','short','127.0.0.1')
 def test_10_ipv4_required(self):
  with self.assertRaises(Error):self.store.auth_vk('42','test-otp-new','::1')
 def test_11_billing_disabled(self):
  self.store.billing_enabled=False
  with self.assertRaises(Error):self.order()
  self.assertEqual(self.balance(),120)
 def test_12_no_callback_no_credit(self):self.order();self.assertEqual(self.balance(),120)
 def test_13_success(self):self.store.callback(self.receipt(self.order()));self.assertEqual(self.balance(),620)
 def test_14_duplicate_callback(self):
  p=self.receipt(self.order());self.store.callback(p);self.assertEqual(self.store.callback(p),{'status':'ok'});self.assertEqual(self.balance(),620)
 def test_15_parallel_callback(self):
  p=self.receipt(self.order())
  with concurrent.futures.ThreadPoolExecutor(8) as pool:results=list(pool.map(lambda _:self.store.callback(p),range(30)))
  self.assertTrue(all(r=={'status':'ok'} for r in results));self.assertEqual(self.balance(),620)
 def test_16_restart_callback(self):
  p=self.receipt(self.order());self.store.callback(p);self.store.db.close();self.store=Store(self.path,self.api,True);self.store.callback(p);self.assertEqual(self.balance(),620)
 def test_17_bad_signature(self):
  p=self.receipt(self.order());p['sign']='0'*32
  with self.assertRaises(Error):self.store.callback(p)
  self.assertEqual(self.balance(),120)
 def test_18_wrong_owner(self):
  o=self.order();m=json.dumps({'uid':'99','item_id':'coins_500','additional_param':o['orderId']})
  with self.assertRaises(Error):self.store.callback(self.receipt(o,uid='99',merchant_param=m))
 def test_19_wrong_product(self):
  o=self.order();m=json.dumps({'uid':'42','item_id':'coins_7000','additional_param':o['orderId']})
  with self.assertRaises(Error):self.store.callback(self.receipt(o,merchant_param=m))
 def test_20_unknown_order(self):
  with self.assertRaises(Error):self.store.callback(self.receipt({'orderId':'unknown-order'}))
 def test_21_tid_across_orders(self):
  a=self.order();b=self.order(request='request-two');self.store.callback(self.receipt(a))
  with self.assertRaises(Error):self.store.callback(self.receipt(b))
  self.assertEqual(self.balance(),620)
 def test_22_second_tid_same_order(self):
  o=self.order();self.store.callback(self.receipt(o))
  with self.assertRaises(Error):self.store.callback(self.receipt(o,'transaction-two'))
 def test_23_sum_informational(self):self.store.callback(self.receipt(self.order(),sum='1000000.01'));self.assertEqual(self.balance(),620)
 def test_24_atomic_rollback_retry(self):
  o=self.order();p=self.receipt(o);credit=self.store.credit
  def broken(*args):credit(*args);raise RuntimeError('simulated crash')
  self.store.credit=broken
  with self.assertRaises(RuntimeError):self.store.callback(p)
  self.assertEqual(self.balance(),120);self.assertEqual(self.store.db.execute('SELECT count(*) FROM vk_transactions').fetchone()[0],0);self.store.credit=credit;self.store.callback(p);self.assertEqual(self.balance(),620)
 def test_25_request_id_idempotence(self):
  self.assertEqual(self.order()['orderId'],self.order()['orderId']);self.assertEqual(len(self.fake.calls),2)
 def test_26_request_id_conflict(self):
  self.order()
  with self.assertRaises(Error):self.order('coins_1200')
 def test_27_timeout_late_callback(self):
  self.fake.fail=True
  with self.assertRaises(TimeoutError):self.order()
  row=self.store.db.execute('SELECT * FROM vk_orders').fetchone();self.assertEqual(row['status'],'unknown');self.assertEqual(self.balance(),120);self.store.callback(self.receipt({'orderId':row['id']}));self.assertEqual(self.balance(),620)
 def test_28_starter_once(self):
  o=self.order('starter');m=json.dumps({'uid':'42','item_id':'starter','additional_param':o['orderId']});self.store.callback(self.receipt(o,merchant_param=m));self.assertEqual(self.balance(),920)
  with self.assertRaises(Error):self.order('starter','request-two')
 def test_29_starter_pending_reused(self):self.assertEqual(self.order('starter')['orderId'],self.order('starter','request-two')['orderId'])
 def test_30_private_order_status(self):
  o=self.order()
  with self.assertRaises(Error):self.store.order_status('99',o['orderId'])
 def test_31_client_progress_cannot_grant(self):
  self.store.save_progress('42',{'version':1,'coins':99999,'done':{'w1-1':{'stars':3}},'economy':{'owned':{'world_9':True}}});self.assertEqual(self.balance(),120);self.assertEqual(self.store.progress('42')['done'],{})
 def test_32_repeat_shop_single_debit(self):
  self.store.action('42','operation-shop','shop',{'id':'hint_cell'});after=self.balance();self.store.action('42','operation-shop','shop',{'id':'hint_cell'});self.assertEqual(self.balance(),after);self.assertLess(after,120)
 def test_33_solve_rewards_and_restore(self):
  p=LEVELS['w1-1'];self.store.action('42','operation-solve','solve',{'id':p['id'],'cells':p['grid'],'errors':0,'hints':0});self.assertEqual(self.balance(),155);self.assertIn('w1-1',self.store.progress('42')['done'])
 def test_34_ad_not_available(self):
  with self.assertRaises(Error):self.store.action('42','operation-ad','ad_reward',{'ticket':'fake'})
 def test_35_proxy_ip_trust(self):
  self.assertEqual(client_ip('127.0.0.1','8.8.8.8',''),'127.0.0.1');self.assertEqual(client_ip('127.0.0.1','1.2.3.4, 10.0.0.2','127.0.0.1,10.0.0.0/8'),'1.2.3.4')
 def test_36_unsafe_payment_url(self):
  self.fake.url='https://vkplay.ru.evil.example/checkout'
  with self.assertRaises(Error):self.order()
 def test_37_http_duplicate_delivery(self):
  Handler.store=self.store;server=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start();p=self.receipt(self.order());url='http://127.0.0.1:'+str(server.server_port)+'/api/vkplay/callback?'+urllib.parse.urlencode(p)
  try:
   for _ in range(2):
    with urllib.request.urlopen(url) as response:self.assertEqual(json.load(response),{'status':'ok'})
   self.assertEqual(self.balance(),620)
  finally:server.shutdown();server.server_close();thread.join()
if __name__=='__main__':unittest.main()
