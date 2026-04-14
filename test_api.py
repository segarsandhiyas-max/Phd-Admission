#!/usr/bin/env python3
import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError

# Test register endpoint
register_data = {
    'email': 'testuser@example.com',
    'password': 'Test123!',
    'full_name': 'Test User',
    'role': 'scholar'
}

try:
    req = Request(
        'http://localhost:8000/api/register',
        method='POST',
        data=json.dumps(register_data).encode(),
        headers={'Content-Type': 'application/json'}
    )
    r = urlopen(req)
    print('✅ REGISTER SUCCESS:')
    print(json.dumps(json.loads(r.read().decode()), indent=2))
except HTTPError as e:
    print(f'❌ REGISTER ERROR {e.code}: {e.reason}')
    print(e.read().decode())
except Exception as e:
    print(f'❌ ERROR: {str(e)}')

# Test login endpoint with form data
print('\n' + '='*50 + '\n')

from urllib.parse import urlencode

login_data = urlencode({
    'username': 'testuser@example.com',
    'password': 'Test123!'
}).encode()

try:
    req = Request(
        'http://localhost:8000/api/login',
        method='POST',
        data=login_data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    r = urlopen(req)
    print('✅ LOGIN SUCCESS:')
    print(json.dumps(json.loads(r.read().decode()), indent=2))
except HTTPError as e:
    print(f'❌ LOGIN ERROR {e.code}: {e.reason}')
    print(e.read().decode())
except Exception as e:
    print(f'❌ ERROR: {str(e)}')
