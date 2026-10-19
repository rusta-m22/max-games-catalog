"""Read-only HTTP deployment check; this is NOT a real VK Play payment test."""
import argparse
import ipaddress
import json
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import Request, urlopen


def check(base_url, expected='ready', allow_local=False):
    url = urlsplit(base_url)
    try:
        local = ipaddress.ip_address(url.hostname).is_loopback
    except (ValueError, TypeError):
        local = url.hostname == 'localhost'
    if url.scheme != 'https' and not (allow_local and local and url.scheme == 'http'):
        raise ValueError('Use HTTPS; --allow-local is only for loopback HTTP tests')
    if not url.hostname or url.username or url.password or url.query or url.fragment or url.path not in ('', '/'):
        raise ValueError('Use a backend origin without credentials, path, query or fragment')
    root = base_url.rstrip('/')
    results = {}
    for path in ('/health', '/ready', '/api/wallet'):
        request = Request(root + path, headers={'Accept': 'application/json'})
        try:
            response = urlopen(request, timeout=10)
        except HTTPError as error:
            response = error
        with response:
            if response.geturl() != root + path:
                raise ValueError('Unexpected redirect')
            value = json.loads(response.read(65536))
            results[path] = {'http': response.code, 'body': value}
    ready = expected == 'ready'
    passed = (results['/health']['http'] == 200 and results['/health']['body'].get('ok') is True
              and results['/health']['body'].get('configured') is ready
              and results['/ready']['http'] == (200 if ready else 503)
              and results['/ready']['body'].get('ready') is ready
              and results['/api/wallet']['http'] == (401 if ready else 503))
    return {'passed': passed, 'expected': expected, 'checks': results,
            'vkPlayTransactionsTested': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('url')
    parser.add_argument('--expect', choices=('ready', 'waiting'), default='ready')
    parser.add_argument('--allow-local', action='store_true')
    args = parser.parse_args()
    try:
        result = check(args.url, args.expect, args.allow_local)
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(0 if result['passed'] else 1)
    except (ValueError, OSError, URLError):
        raise SystemExit('Check failed: verify HTTPS URL, network and JSON service response') from None
