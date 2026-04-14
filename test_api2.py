#!/usr/bin/env python3
import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError

# Test with simpler password
register_data = {
    'email': 'test2@example.com',
    'password': 'abc123',
    'full_name': 'Test User 2',
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
    response = json.loads(r.read().decode())
    print(json.dumps(response, indent=2, default=str))
    
    # Now try to login
    print('\n' + '='*50 + '\n')
    login_user_id = response.get('id', '')
    
    from urllib.parse import urlencode
    login_data = urlencode({
        'username': register_data['email'],
        'password': register_data['password']
    }).encode()
    
    req = Request(
        'http://localhost:8000/api/login',
        method='POST',
        data=login_data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    r = urlopen(req)
    print('✅ LOGIN SUCCESS:')
    login_response = json.loads(r.read().decode())
    print(json.dumps(login_response, indent=2, default=str))
    
except HTTPError as e:
    error_body = e.read().decode()
    print(f'❌ ERROR {e.code}: {e.reason}')
    print('Response body:', error_body)
    try:
        print(json.dumps(json.loads(error_body), indent=2))
    except:
        pass
except Exception as e:
    print(f'❌ ERROR: {type(e).__name__}: {str(e)}')
    import traceback
    traceback.print_exc()
