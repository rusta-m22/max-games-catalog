"""Real loopback HTTP errors; no request reaches VK Play or a payment system."""
import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch
from urllib.error import URLError

import test_payments
from economy_core import Error
from vkplay import BillingRejected, transport


class ResponseHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        self.rfile.read(int(self.headers.get('Content-Length', '0')))
        self.server.requests += 1
        status, payload = self.server.response
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass


class CheckoutHTTP(unittest.TestCase):
    order = test_payments.Payments.order
    receipt = test_payments.Payments.receipt
    balance = test_payments.Payments.balance

    @classmethod
    def setUpClass(cls):
        cls.http = ThreadingHTTPServer(('127.0.0.1', 0), ResponseHandler)
        cls.thread = threading.Thread(target=cls.http.serve_forever, daemon=True)
        cls.thread.start()
        cls.url = 'http://127.0.0.1:' + str(cls.http.server_port) + '/checkout'

    @classmethod
    def tearDownClass(cls):
        cls.http.shutdown()
        cls.http.server_close()
        cls.thread.join()

    def setUp(self):
        test_payments.Payments.setUp(self)
        self.http.requests = 0
        self.response(200, {'status': 'ok', 'url': 'https://vkplay.ru/local-test-checkout'})
        self.api.request = lambda method, url, data=None: transport(method, self.url, data)

    tearDown = test_payments.Payments.tearDown

    def response(self, status, payload):
        raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode()
        self.http.response = status, raw

    def state(self):
        return self.store.db.execute('SELECT status FROM vk_orders ORDER BY rowid DESC').fetchone()[0]

    def test_documented_http_400_rejection_releases_only_failed_attempt(self):
        self.response(400, {'status': 'error', 'errcode': '2003', 'errmsg': 'private-upstream-message'})
        with self.assertLogs(level='WARNING') as logs, self.assertRaises(BillingRejected):
            self.order('starter')
        self.assertEqual(self.state(), 'failed')
        self.assertEqual(self.balance(), 120)
        self.assertNotIn('private-upstream-message', '\n'.join(logs.output))
        self.assertIn('code=2003', '\n'.join(logs.output))
        # The same request never sends upstream twice, even after a rejection.
        with self.assertRaises(BillingRejected):
            self.order('starter')
        self.assertEqual(self.http.requests, 1)
        self.response(200, {'status': 'ok', 'url': 'https://vkplay.ru/local-test-checkout'})
        self.assertEqual(self.order('starter', 'new-request')['status'], 'pending')
        self.assertEqual(self.balance(), 120)

    def test_http_403_html_stays_unknown_and_is_never_automatically_retried(self):
        self.response(403, b'<html>private-gateway-message</html>')
        with self.assertLogs(level='WARNING') as logs, self.assertRaises(Error) as failure:
            self.order()
        self.assertEqual(failure.exception.code, 'VKPLAY_HTTP_ERROR')
        self.assertEqual(self.state(), 'unknown')
        self.assertNotIn('private-gateway-message', '\n'.join(logs.output))
        self.assertIn('http=403', '\n'.join(logs.output))
        with self.assertRaises(Error) as repeat:
            self.order()
        self.assertEqual(repeat.exception.code, 'ORDER_STATUS_UNKNOWN')
        self.assertEqual(self.http.requests, 1)
        self.assertEqual(self.balance(), 120)

    def test_http_503_even_with_api_error_body_remains_uncertain(self):
        self.response(503, {'status': 'error', 'errcode': 2004})
        with self.assertLogs(level='WARNING'), self.assertRaises(Error):
            self.order()
        self.assertEqual(self.state(), 'unknown')
        self.assertEqual(self.balance(), 120)

    def test_throttle_and_request_timeout_never_release_uncertain_attempt(self):
        for status in (408, 429):
            with self.subTest(http=status):
                self.response(status, {'status': 'error', 'errcode': 2003})
                with self.assertLogs(level='WARNING'), self.assertRaises(Error):
                    self.order(request='request-' + str(status))
                self.assertEqual(self.state(), 'unknown')
        self.assertEqual(self.balance(), 120)

    def test_unknown_or_private_api_error_code_is_not_logged_or_assumed_rejected(self):
        for code in ('private-code-never-log', 9999, True):
            with self.subTest(code=code):
                self.response(403, {'status': 'error', 'errcode': code})
                with self.assertLogs(level='WARNING') as logs, self.assertRaises(Error):
                    self.order(request='request-' + str(self.http.requests))
                self.assertEqual(self.state(), 'unknown')
                self.assertNotIn('private-code-never-log', '\n'.join(logs.output))

    def test_malformed_success_json_cannot_become_a_retryable_rejection(self):
        for index, value in enumerate((b'not-json-private-body', [], None, {'unrecognized': 'private-value'})):
            with self.subTest(value=value):
                self.response(200, value)
                with self.assertLogs(level='WARNING') as logs, self.assertRaises(Error) as failure:
                    self.order(request='malformed-' + str(index))
                self.assertEqual(failure.exception.code, 'VKPLAY_INVALID_RESPONSE')
                self.assertEqual(self.state(), 'unknown')
                self.assertNotIn('private-value', '\n'.join(logs.output))
                self.assertNotIn('not-json-private-body', '\n'.join(logs.output))
        self.assertEqual(self.balance(), 120)

    def test_documented_api_rejection_in_http_200_is_still_definite(self):
        self.response(200, {'status': 'error', 'errcode': 5001, 'errmsg': 'private-error'})
        with self.assertLogs(level='WARNING') as logs, self.assertRaises(BillingRejected):
            self.order()
        self.assertEqual(self.state(), 'failed')
        self.assertIn('code=5001', '\n'.join(logs.output))
        self.assertNotIn('private-error', '\n'.join(logs.output))

    def test_successful_checkout_still_needs_signed_callback_to_credit(self):
        result = self.order()
        self.assertEqual(result['status'], 'pending')
        self.assertEqual(self.balance(), 120)
        receipt = self.receipt(result)
        self.store.callback(receipt)
        self.store.callback(receipt)
        self.assertEqual(self.balance(), 620)

    def test_vkpay_checkout_origin_is_accepted_without_changing_payment_parameters(self):
        payment_url = 'https://co.vkpay.ru/local-checkout?order=local%2F123&return_url=https%3A%2F%2Fvkplay.ru%2F'
        self.response(200, {'status': 'ok', 'url': payment_url})
        result = self.order()
        self.assertEqual(result['status'], 'pending')
        self.assertEqual(result['paymentUrl'], payment_url)
        self.assertEqual(self.balance(), 120)
        receipt = self.receipt(result)
        self.store.callback(receipt)
        self.store.callback(receipt)
        self.assertEqual(self.balance(), 620)

    def test_vkpay_lookalikes_and_unsafe_origins_are_still_rejected(self):
        urls = ('https://co.vkpay.ru.evil.example/pay', 'https://co-vkpay.ru/pay',
                'https://other.vkpay.ru/pay', 'http://co.vkpay.ru/pay',
                'https://co.vkpay.ru:444/pay', 'https://user:password@co.vkpay.ru/pay')
        for index, url in enumerate(urls):
            with self.subTest(url=url):
                self.response(200, {'status': 'ok', 'url': url})
                with self.assertLogs(level='WARNING'), self.assertRaises(Error) as failure:
                    self.order(request='unsafe-vkpay-' + str(index))
                self.assertEqual(failure.exception.code, 'UNEXPECTED_PAYMENT_HOST')
                self.assertEqual(self.state(), 'unknown')
        self.assertEqual(self.balance(), 120)

    def test_late_signed_callback_after_http_failure_remains_authoritative(self):
        self.response(503, b'private-gateway-body')
        with self.assertLogs(level='WARNING'), self.assertRaises(Error):
            self.order()
        order_id = self.store.db.execute('SELECT id FROM vk_orders').fetchone()[0]
        receipt = self.receipt({'orderId': order_id})
        self.store.callback(receipt)
        self.store.callback(receipt)
        self.assertEqual(self.order(), {'orderId': order_id, 'status': 'paid'})
        self.assertEqual(self.http.requests, 1)
        self.assertEqual(self.balance(), 620)

    def test_payment_url_validation_does_not_log_signed_url(self):
        self.response(200, {'status': 'ok', 'url': 'https://unapproved.example/pay?private-payment-token'})
        with self.assertLogs(level='WARNING') as logs, self.assertRaises(Error) as failure:
            self.order()
        self.assertEqual(failure.exception.code, 'UNEXPECTED_PAYMENT_HOST')
        self.assertIn('payment_url_not_allowed', '\n'.join(logs.output))
        self.assertIn('scheme=https host=unapproved.example port=default userinfo=0', '\n'.join(logs.output))
        self.assertNotIn('private-payment-token', '\n'.join(logs.output))
        self.assertEqual(self.state(), 'unknown')

    def test_url_diagnostics_identify_format_without_logging_private_components(self):
        cases = (
            (None, 'value_type=missing'),
            ({'private-value': 'private-token'}, 'value_type=object'),
            ('/private-path?private-token', 'scheme=none host=none'),
            ('http://vkplay.ru/private-path?private-token', 'scheme=http host=vkplay.ru'),
            ('https://private-user:private-password@vkplay.ru:444/private-path?private-token#private-fragment', 'host=vkplay.ru port=444 userinfo=1'),
            ('https://vkplay.ru:invalid/private-path?private-token', 'host=vkplay.ru port=invalid'),
            ('https://[invalid/private-path?private-token', 'format=invalid'),
            ('https://bad%0ahost/private-path?private-token', 'host=invalid'),
        )
        for index, (value, expected) in enumerate(cases):
            with self.subTest(index=index):
                self.response(200, {'status': 'ok', 'url': value})
                with self.assertLogs(level='WARNING') as logs, self.assertRaises(Error) as failure:
                    self.order(request='url-format-' + str(index))
                output = '\n'.join(logs.output)
                self.assertEqual(failure.exception.code, 'UNEXPECTED_PAYMENT_HOST')
                self.assertIn(expected, output)
                self.assertNotIn('private-', output)
                self.assertNotIn('bad%0a', output)
                self.assertEqual(self.state(), 'unknown')
        self.assertEqual(self.balance(), 120)

    def test_network_diagnostics_never_include_exception_url_or_request_values(self):
        upstream = 'https://vkplay.ru/app/12345/billing/item/client?sign=private-signature'
        for error in (URLError('private-exception-url'), TimeoutError('private-timeout')):
            with self.subTest(error=type(error).__name__), patch('vkplay.urlopen', side_effect=error):
                with self.assertLogs(level='WARNING') as logs, self.assertRaises(Error) as failure:
                    transport('POST', upstream, {'merchant_param': 'private-merchant'})
                self.assertEqual(failure.exception.code, 'VKPLAY_NETWORK_ERROR')
                output = '\n'.join(logs.output) + str(failure.exception)
                for forbidden in ('private-signature', 'private-exception-url', 'private-timeout', 'private-merchant'):
                    self.assertNotIn(forbidden, output)

    def test_response_size_limit_does_not_release_order_or_credit(self):
        self.response(200, b' ' * (1024 * 1024 + 1))
        with self.assertLogs(level='WARNING'), self.assertRaises(Error) as failure:
            self.order()
        self.assertEqual(failure.exception.code, 'PLATFORM_RESPONSE_TOO_LARGE')
        self.assertEqual(self.state(), 'unknown')
        self.assertEqual(self.balance(), 120)


if __name__ == '__main__':
    unittest.main()
