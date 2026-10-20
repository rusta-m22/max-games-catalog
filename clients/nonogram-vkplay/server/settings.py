"""Validated deployment settings. This module never prints secret values."""
import ipaddress
import json
import os
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path


class ConfigurationError(ValueError):
    pass


def unique_items(pairs):
    values = {}
    for key, value in pairs:
        if key in values:
            raise ValueError('Duplicate product key')
        values[key] = value
    return values


@dataclass
class Settings:
    app_id: str = ''
    secret: str = field(default='', repr=False)
    billing_enabled: bool = False
    payment_hosts: tuple = ('vkplay.ru', 'co.vkpay.ru')
    trusted_proxies: str = ''
    item_ids: dict = field(default_factory=dict)
    data_dir: Path = Path('./data')
    bind: str = '0.0.0.0'
    port: int = 8080
    max_requests: int = 32

    @property
    def configured(self):
        return bool(self.app_id and self.secret)

    def public_status(self):
        return {'configured': self.configured, 'billingEnabled': self.billing_enabled,
                'catalogMapped': bool(self.item_ids),
                'proxyTrustConfigured': bool(self.trusted_proxies)}


def load_settings(env=None):
    env = os.environ if env is None else env
    def number(name, default, low, high):
        raw = env.get(name, str(default))
        if not re.fullmatch(r'[0-9]+', raw) or not low <= int(raw) <= high:
            raise ConfigurationError(f'{name}: invalid integer or range')
        return int(raw)
    billing = env.get('VKPLAY_BILLING_ENABLED', 'false')
    if billing not in ('true', 'false'):
        raise ConfigurationError('VKPLAY_BILLING_ENABLED: use true or false')
    app_id, secret = env.get('VKPLAY_APP_ID', ''), env.get('VKPLAY_SECRET', '')
    if bool(app_id) != bool(secret):
        raise ConfigurationError('VKPLAY_APP_ID and VKPLAY_SECRET must both be set, or both absent')
    if app_id and (not re.fullmatch(r'[1-9][0-9]{0,15}', app_id) or len(secret) < 16):
        raise ConfigurationError('VKPLAY_APP_ID or VKPLAY_SECRET is invalid')
    hosts = tuple(x.strip().lower() for x in env.get('VKPLAY_PAYMENT_HOSTS', 'vkplay.ru,co.vkpay.ru').split(','))
    if any(not re.fullmatch(r'[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?', x) or '.' not in x or '..' in x for x in hosts):
        raise ConfigurationError('VKPLAY_PAYMENT_HOSTS: use exact domain names, no URLs or wildcard')
    trusted = env.get('TRUSTED_PROXY_IPS', '')
    try:
        networks = [ipaddress.ip_network(x.strip()) for x in trusted.split(',') if x.strip()]
        if any(x.prefixlen == 0 for x in networks):
            raise ValueError()
    except ValueError:
        raise ConfigurationError('TRUSTED_PROXY_IPS: use verified proxy IPs/CIDRs, never a catch-all') from None
    item_ids = {}
    raw_ids = env.get('VKPLAY_ITEMDEF_IDS', '')
    if raw_ids:
        try:
            if raw_ids.lstrip().startswith('{'):
                item_ids = json.loads(raw_ids, object_pairs_hook=unique_items)
            else:
                pairs = [pair.strip().split('=') for pair in raw_ids.split(',')]
                if any(len(pair) != 2 for pair in pairs):
                    raise ValueError()
                item_ids = unique_items((key.strip(), value.strip()) for key, value in pairs)
            required = {'coins_500', 'coins_1200', 'coins_3000', 'coins_7000', 'starter'}
            if not isinstance(item_ids, dict) or set(item_ids) != required:
                raise ValueError()
            if any(isinstance(v, bool) or not isinstance(v, (int, str)) or not re.fullmatch(r'[1-9][0-9]{0,15}', str(v)) for v in item_ids.values()):
                raise ValueError()
            item_ids = {k: str(v) for k, v in item_ids.items()}
            if len(set(item_ids.values())) != len(required):
                raise ValueError()
        except (ValueError, TypeError):
            raise ConfigurationError('VKPLAY_ITEMDEF_IDS: expected all five products as JSON or comma-separated product=id pairs, with unique positive itemdefid values') from None
    if billing == 'true' and (not app_id or not item_ids):
        raise ConfigurationError('Billing requires VKPLAY_APP_ID, VKPLAY_SECRET and VKPLAY_ITEMDEF_IDS')
    return Settings(app_id=app_id, secret=secret, billing_enabled=billing == 'true',
                    payment_hosts=hosts, trusted_proxies=trusted, item_ids=item_ids,
                    data_dir=Path(env.get('DATA_DIR', './data')),
                    bind=env.get('BIND_ADDRESS', '0.0.0.0'),
                    port=number('PORT', 8080, 1, 65535),
                    max_requests=number('MAX_CONCURRENT_REQUESTS', 32, 1, 128))


if __name__ == '__main__':
    try:
        config = load_settings()
        print(json.dumps(config.public_status()))
        raise SystemExit(2 if '--strict' in sys.argv and not config.configured else 0)
    except ConfigurationError as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(1)
