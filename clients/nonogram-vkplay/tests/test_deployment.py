"""Local deployment lifecycle tests. Never contacts VK Play or creates a real charge."""
import http.client
import json
import os
import socket
import sqlite3
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
SERVER = ROOT / 'server' if (ROOT / 'server').is_dir() else ROOT
sys.path.insert(0, str(SERVER))
from app import Store, Handler, ServiceHTTPServer, create_server
from backup import backup
from settings import Settings, ConfigurationError, load_settings
from smoke_check import check
from vkplay import sign
from test_payments import FakeTransport, SECRET

IDS = dict(zip(('coins_500', 'coins_1200', 'coins_3000', 'coins_7000', 'starter'), range(2001, 2006)))
ENV = {'VKPLAY_APP_ID': '12345', 'VKPLAY_SECRET': SECRET}


class Configuration(unittest.TestCase):
    def test_empty_settings_bootstrap_only(self):
        c = load_settings({})
        self.assertFalse(c.configured)
        self.assertFalse(c.billing_enabled)

    def test_partial_credentials_fail(self):
        for env in ({'VKPLAY_APP_ID': '12345'}, {'VKPLAY_SECRET': SECRET}):
            with self.assertRaises(ConfigurationError): load_settings(env)

    def test_invalid_switch_fails_closed(self):
        with self.assertRaises(ConfigurationError): load_settings({**ENV, 'VKPLAY_BILLING_ENABLED': 'yes'})

    def test_sales_require_explicit_catalog_mapping(self):
        with self.assertRaises(ConfigurationError): load_settings({**ENV, 'VKPLAY_BILLING_ENABLED': 'true'})
        c = load_settings({**ENV, 'VKPLAY_BILLING_ENABLED': 'true', 'VKPLAY_ITEMDEF_IDS': json.dumps(IDS)})
        self.assertTrue(c.billing_enabled)
        self.assertEqual(c.item_ids['coins_500'], '2001')

    def test_bad_catalog_mappings_rejected(self):
        for ids in ([], {'coins_500': 1}, {**IDS, 'starter': 2001}, {**IDS, 'starter': True}, {**IDS, 'starter': '../x'}):
            with self.assertRaises(ConfigurationError): load_settings({**ENV, 'VKPLAY_ITEMDEF_IDS': json.dumps(ids)})

    def test_bad_network_configuration_rejected(self):
        for env in ({'TRUSTED_PROXY_IPS': '0.0.0.0/0'}, {'TRUSTED_PROXY_IPS': '::/0'},
                    {'TRUSTED_PROXY_IPS': 'not-an-ip'}, {'VKPLAY_PAYMENT_HOSTS': '*.vkplay.ru'},
                    {'VKPLAY_PAYMENT_HOSTS': 'https://vkplay.ru'}, {'PORT': '99999'}, {'MAX_CONCURRENT_REQUESTS': '0'}):
            with self.assertRaises(ConfigurationError): load_settings(env)

    def test_status_and_repr_do_not_reveal_secret(self):
        c = load_settings(ENV)
        self.assertNotIn(SECRET, repr(c) + json.dumps(c.public_status()))

    def test_smoke_checker_requires_https(self):
        for url in ('http://example.com', 'https://u:p@example.com', 'https://example.com?key=1'):
            with self.assertRaises(ValueError): check(url, allow_local=True)


class Deployment(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.config = Settings(app_id='12345', secret=SECRET, data_dir=Path(self.tmp.name),
                               bind='127.0.0.1', port=0, item_ids=IDS, billing_enabled=True)
        self.start()

    def start(self):
        self.server = create_server(self.config)
        self.store = self.server.RequestHandlerClass.store
        if self.store: self.store.api.request = FakeTransport()
        self.thread = threading.Thread(target=self.server.serve_forever, kwargs={'poll_interval': 0.01}, daemon=True)
        self.thread.start()
        self.url = 'http://127.0.0.1:' + str(self.server.server_port)

    def stop(self):
        self.server.shutdown(); self.server.server_close(); self.thread.join()
        if self.store: self.store.db.close()

    def tearDown(self):
        self.stop(); self.tmp.cleanup()

    def request(self, path, data=None, token=None):
        headers = {'Content-Type': 'application/json'}
        if token: headers['Authorization'] = 'Bearer ' + token
        req = Request(self.url + path, data=None if data is None else json.dumps(data).encode(), headers=headers)
        try: response = urlopen(req, timeout=3)
        except HTTPError as error: response = error
        with response: return response.code, json.load(response)

    def auth(self):
        code, auth = self.request('/api/vkplay/auth', {'uid': '42', 'otp': 'local-otp-one'})
        self.assertEqual(code, 200)
        return auth['token']

    def pay(self):
        token = self.auth()
        code, order = self.request('/api/vkplay/order', {'product': 'coins_500', 'requestId': 'local-request'}, token)
        self.assertEqual(code, 200)
        p = {'uid': '42', 'sum': '99.00', 'tid': 'local-transaction',
             'merchant_param': json.dumps({'uid': '42', 'item_id': 'coins_500', 'additional_param': order['orderId']})}
        p['sign'] = sign(p, SECRET)
        self.store.callback(p)
        return token, p

    def test_configured_http_service(self):
        self.assertTrue(check(self.url, allow_local=True)['passed'])

    def test_bootstrap_blocks_auth_and_retries_callback(self):
        self.stop(); self.config.app_id = self.config.secret = ''; self.config.billing_enabled = False; self.start()
        self.assertTrue(check(self.url, expected='waiting', allow_local=True)['passed'])
        self.assertEqual(self.request('/api/vkplay/auth', {'uid': '42', 'otp': 'local-otp-one'})[0], 503)
        self.assertEqual(self.request('/api/vkplay/callback')[1], {'status': 'error', 'errcode': 0, 'errmsg': 'RETRY_LATER'})

    def test_item_mapping_is_used_in_outbound_order(self):
        self.pay()
        self.assertEqual(self.store.api.request.calls[-1][2]['ids'], '2001')

    def test_backup_restores_wallet_receipt_session_and_idempotence(self):
        token, receipt = self.pay()
        self.store.save_progress('42', {'version': 1, 'settings': {'sound': False}})
        dest = backup(Path(self.tmp.name) / 'vkplay.sqlite3', Path(self.tmp.name) / 'backups' / 'restore.sqlite3')
        restored = Store(str(dest), self.store.api, True, products=self.store.products)
        try:
            self.assertEqual(restored.authenticated(token), '42')
            self.assertEqual(restored.wallet('42')['coins'], 620)
            self.assertEqual(restored.progress('42')['settings'], {'sound': False})
            self.assertEqual(restored.callback(receipt), {'status': 'ok'})
            self.assertEqual(restored.wallet('42')['coins'], 620)
            self.assertEqual(restored.db.execute('PRAGMA integrity_check').fetchone()[0], 'ok')
        finally: restored.db.close()

    def test_backup_never_overwrites_existing_file(self):
        dest = Path(self.tmp.name) / 'existing'
        dest.write_bytes(b'keep')
        with self.assertRaises(ValueError): backup(Path(self.tmp.name) / 'vkplay.sqlite3', dest)
        self.assertEqual(dest.read_bytes(), b'keep')

    def test_missing_backup_source_does_not_create_database(self):
        source = Path(self.tmp.name) / 'missing.sqlite3'
        with self.assertRaises(ValueError): backup(source, Path(self.tmp.name) / 'copy.sqlite3')
        self.assertFalse(source.exists())

    def test_http_rejects_unhashable_product(self):
        token = self.auth()
        self.assertEqual(self.request('/api/vkplay/order', {'product': [], 'requestId': 'local-request'}, token)[0], 400)

    def test_conflicting_content_lengths_rejected(self):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.server_port, timeout=3)
        try:
            connection.putrequest('POST', '/api/vkplay/auth')
            connection.putheader('Content-Length', '2'); connection.putheader('Content-Length', '2')
            connection.endheaders(b'{}')
            response = connection.getresponse()
            self.assertEqual(response.status, 400); response.read()
        finally: connection.close()

    def test_readiness_detects_closed_database(self):
        self.store.db.close()
        with self.assertLogs(level='ERROR'):
            self.assertEqual(self.request('/ready')[0], 503)


class Lifecycle(unittest.TestCase):
    def test_process_starts_without_vk_credentials_and_stops_on_sigterm(self):
        with tempfile.TemporaryDirectory() as directory:
            with socket.socket() as reserved:
                reserved.bind(('127.0.0.1', 0)); port = reserved.getsockname()[1]
            env = {k: v for k, v in os.environ.items() if not k.startswith('VKPLAY_') and k not in ('TRUSTED_PROXY_IPS', 'MAX_CONCURRENT_REQUESTS')}
            env.update(DATA_DIR=directory, BIND_ADDRESS='127.0.0.1', PORT=str(port))
            process = subprocess.Popen([sys.executable, str(SERVER / 'app.py')], env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
            try:
                deadline = time.monotonic() + 5
                while True:
                    try:
                        result = check(f'http://127.0.0.1:{port}', expected='waiting', allow_local=True)
                        break
                    except OSError:
                        if time.monotonic() > deadline or process.poll() is not None: raise
                        time.sleep(0.03)
                self.assertTrue(result['passed'])
                process.terminate(); out, err = process.communicate(timeout=5)
                self.assertEqual(process.returncode, 0, out + err)
                self.assertFalse((Path(directory) / 'vkplay.sqlite3').exists())
            finally:
                if process.poll() is None: process.kill(); process.communicate()

    def test_worker_limit_rejects_overload_and_recovers(self):
        started = threading.Event(); release = threading.Event()
        class HeldHandler(Handler):
            store = None
            def setup(self):
                super().setup(); started.set(); release.wait(3)
        server = ServiceHTTPServer(('127.0.0.1', 0), HeldHandler, max_requests=1)
        thread = threading.Thread(target=server.serve_forever, kwargs={'poll_interval': 0.01}, daemon=True); thread.start()
        first = socket.create_connection(server.server_address, timeout=3)
        try:
            self.assertTrue(started.wait(2))
            with self.assertRaises(HTTPError) as failed: urlopen(f'http://127.0.0.1:{server.server_port}/health', timeout=3)
            self.assertEqual(failed.exception.code, 503); failed.exception.close()
            release.set(); first.sendall(b'GET /health HTTP/1.0\r\n\r\n')
            self.assertIn(b'200 OK', first.recv(4096))
        finally:
            release.set(); first.close(); server.shutdown(); server.server_close(); thread.join()


if __name__ == '__main__': unittest.main()
