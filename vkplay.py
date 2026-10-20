"""VK Play GAS + inventory billing; no client-side secret or synthetic payment mode."""
import hashlib
import hmac
import ipaddress
import json
import logging
import re
import socket
import ssl
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen
from economy_core import Error, dump

class BillingRejected(Error):
    """The platform returned a definite error, rather than an ambiguous timeout."""
    def __init__(self):
        super().__init__('VKPLAY_BILLING_REJECTED', 502)

def sign(params, secret):
    # VK Play's specified MD5 protocol, not a password hashing algorithm.
    raw = ''.join(f'{k}={params[k]}' for k in sorted(params) if k != 'sign') + secret
    return hashlib.md5(raw.encode('utf-8')).hexdigest()

def valid_signature(params, secret):
    actual = params.get('sign', '')
    return isinstance(actual, str) and bool(re.fullmatch(r'[0-9a-f]{32}', actual)) and hmac.compare_digest(sign(params, secret), actual)

def ipv4(value):
    try:
        parsed = ipaddress.ip_address(value)
        if parsed.version != 4: raise ValueError()
        return str(parsed)
    except ValueError:
        raise Error('IPV4_REQUIRED', 400)

HTTP_API_REJECTIONS = frozenset(('1002', '2000', '2001', '2002', '2003', '2004', '5001'))

def platform_code(value):
    # Never echo errmsg or an arbitrary upstream value into application logs.
    code = value.get('errcode') if isinstance(value, dict) else None
    if isinstance(code, bool) or not isinstance(code, (int, str)):
        return 'unspecified'
    return str(code) if re.fullmatch(r'[0-9]{1,6}', str(code)) else 'unspecified'

def response_json(response):
    raw = response.read(1024 * 1024 + 1)
    if len(raw) > 1024 * 1024:
        raise Error('PLATFORM_RESPONSE_TOO_LARGE', 502)
    try:
        value = json.loads(raw)
    except (ValueError, UnicodeError):
        raise Error('VKPLAY_INVALID_RESPONSE', 502) from None
    if not isinstance(value, dict):
        raise Error('VKPLAY_INVALID_RESPONSE', 502)
    return value

def checkout_origin(value):
    """Bounded diagnostics only: never include a path, query, fragment or userinfo."""
    if not isinstance(value, str):
        kind = 'missing' if value is None else 'object' if isinstance(value, dict) else 'array' if isinstance(value, list) else 'other'
        return f'value_type={kind}'
    try:
        parsed = urlsplit(value)
        host = parsed.hostname or 'none'
        if len(host) > 253 or not re.fullmatch(r'[a-z0-9.-]+', host):
            host = 'invalid'
        scheme = parsed.scheme or 'none'
        if not re.fullmatch(r'[a-z][a-z0-9+.-]{0,19}', scheme):
            scheme = 'invalid'
        try:
            port = str(parsed.port) if parsed.port is not None else 'default'
        except ValueError:
            port = 'invalid'
        credentials = bool(parsed.username is not None or parsed.password is not None)
        return f'value_type=string scheme={scheme} host={host} port={port} userinfo={int(credentials)}'
    except ValueError:
        return 'value_type=string format=invalid'

def transport(method, url, data=None):
    body = urlencode(data).encode() if data is not None else None
    req = Request(url, data=body, method=method, headers={'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'})
    operation = 'gas' if urlsplit(url).path.endswith('/gas') else 'billing'
    try:
        try:
            response = urlopen(req, timeout=15)
        except HTTPError as rejection:
            status = rejection.code
            try:
                with rejection:
                    value = response_json(rejection)
            except Error:
                logging.warning('VK Play HTTP failure operation=%s http=%d response=invalid', operation, status)
                raise Error('VKPLAY_HTTP_ERROR', 502) from None
            code = platform_code(value)
            # Only a documented API rejection on a definite client error is
            # retryable. Gateway errors, throttling and timeouts stay uncertain.
            if 400 <= status < 500 and status not in (408, 429) and value.get('status') == 'error' and code in HTTP_API_REJECTIONS:
                logging.warning('VK Play API rejection operation=%s http=%d code=%s', operation, status, code)
                return value
            logging.warning('VK Play HTTP failure operation=%s http=%d code=%s outcome=uncertain', operation, status, code)
            raise Error('VKPLAY_HTTP_ERROR', 502) from None
        with response:
            try:
                return response_json(response)
            except Error as failure:
                logging.warning('VK Play response failure operation=%s reason=%s', operation, failure.code)
                raise
    except (URLError, OSError) as failure:
        reason = getattr(failure, 'reason', failure)
        category = 'timeout' if isinstance(reason, TimeoutError) else 'dns' if isinstance(reason, socket.gaierror) else 'tls' if isinstance(reason, ssl.SSLError) else 'connection'
        logging.warning('VK Play network failure operation=%s reason=%s', operation, category)
        raise Error('VKPLAY_NETWORK_ERROR', 502) from None

class VKPlay:
    def __init__(self, app_id, secret, request=transport, payment_hosts=('vkplay.ru',)):
        if not re.fullmatch(r'[1-9][0-9]{0,15}', str(app_id)) or len(secret) < 16:
            raise RuntimeError('Configure VKPLAY_APP_ID and VKPLAY_SECRET on the server')
        self.app_id, self.secret, self.request = str(app_id), secret, request
        self.payment_hosts = set(payment_hosts)

    def gas(self, uid, otp, ip):
        if not isinstance(uid,str) or not re.fullmatch(r'[0-9]{1,24}',uid): raise Error('INVALID_UID',400)
        if not isinstance(otp,str) or not 8 <= len(otp) <= 4096: raise Error('INVALID_OTP',400)
        params = {'uid':uid, 'hash':otp, 'ip':ipv4(ip)}
        signature = sign({**params,'appid':self.app_id}, self.secret)
        # A consumed OTP is NEVER automatically retried.
        result = self.request('GET', f'https://vkplay.ru/app/{self.app_id}/gas?'+urlencode({**params,'sign':signature}))
        if result.get('status') != 'ok': raise Error('VKPLAY_AUTH_REJECTED',401)
        return uid

    def billing(self, uid, ip, product, order_id):
        merchant = {'uid':uid,'ip':ipv4(ip),'item_id':product['id'],'additional_param':order_id}
        params = {'ids':str(product['itemDefId']), 'merchant_param':dump(merchant)}
        url = f'https://vkplay.ru/app/{self.app_id}/billing/item/client?'+urlencode({'sign':sign(params,self.secret)})
        result = self.request('POST',url,params)
        if not isinstance(result, dict) or result.get('status') not in ('ok', 'error'):
            logging.warning('VK Play checkout response reason=invalid_status')
            raise Error('VKPLAY_INVALID_RESPONSE', 502)
        if result.get('status') == 'error':
            logging.warning('VK Play checkout rejected code=%s', platform_code(result))
            raise BillingRejected()
        payment_url = result.get('url')
        try:
            if not isinstance(payment_url, str): raise ValueError()
            u = urlsplit(payment_url)
            valid = u.scheme == 'https' and u.hostname in self.payment_hosts and u.port in (None,443) and not u.username and not u.password
        except ValueError: valid = False
        if not valid:
            logging.warning('VK Play checkout response reason=payment_url_not_allowed %s', checkout_origin(payment_url))
            raise Error('UNEXPECTED_PAYMENT_HOST',502)
        return payment_url
