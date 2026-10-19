"""VK Play GAS + inventory billing; no client-side secret or synthetic payment mode."""
import hashlib
import hmac
import ipaddress
import json
import re
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

def transport(method, url, data=None):
    body = urlencode(data).encode() if data is not None else None
    req = Request(url, data=body, method=method, headers={'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'})
    with urlopen(req, timeout=15) as r:
        raw = r.read(1024 * 1024 + 1)
        if len(raw) > 1024 * 1024: raise Error('PLATFORM_RESPONSE_TOO_LARGE', 502)
        return json.loads(raw)

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
        if result.get('status') != 'ok': raise BillingRejected()
        payment_url = result.get('url','')
        try:
            u = urlsplit(payment_url)
            valid = u.scheme == 'https' and u.hostname in self.payment_hosts and u.port in (None,443) and not u.username and not u.password
        except ValueError: valid = False
        if not valid: raise Error('UNEXPECTED_PAYMENT_HOST',502)
        return payment_url
