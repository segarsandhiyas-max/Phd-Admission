#!/usr/bin/env python3
"""
Test script to verify login with the first user created
"""
import json
from urllib.request import urlopen, Request
from urllib.parse import urlencode
from urllib.error import HTTPError, URLError

BASE_URL = "http://localhost:8000"

print("🧪 Testing login with first user credentials")
print("=" * 80)

# First user details from database
email = "akshu.akv@gmail.com"
password = "123456"

print(f"\n📧 Email: {email}")
print(f"🔑 Password: {password}")

# Test login
print("\n📝 Attempting login...")
try:
    login_data = urlencode({
        'username': email,
        'password': password
    }).encode()
    
    req = Request(
        f"{BASE_URL}/api/login",
        method='POST',
        data=login_data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    
    response = urlopen(req)
    response_data = json.loads(response.read().decode())
    
    print(f"Status Code: {response.status}")
    print(f"Response: {json.dumps(response_data, indent=2)}")
    
    print("\n✅ LOGIN SUCCESSFUL!")
    print(f"   Token: {response_data['access_token'][:50]}...")
    print(f"   User: {response_data['user']['full_name']}")
    print(f"   Role: {response_data['user']['role']}")
    print(f"   Email: {response_data['user']['email']}")
        
except HTTPError as e:
    print(f"\n❌ LOGIN FAILED!")
    print(f"   Status Code: {e.code}")
    print(f"   Error: {e.read().decode()}")
    
except URLError as e:
    print("\n❌ ERROR: Cannot connect to backend server!")
    print("   Make sure the backend is running on http://localhost:8000")
    print(f"   Details: {str(e)}")
except Exception as e:
    print(f"\n❌ ERROR: {str(e)}")

print("\n" + "=" * 80)
print("\n💡 TROUBLESHOOTING TIPS:")
print("   1. Make sure backend is running: cd backend && python main.py")
print("   2. Make sure frontend is running: cd frontend && npm run dev")
print("   3. Use email: akshu.akv@gmail.com")
print("   4. Use password: 123456")
print("   5. Clear browser cache/localStorage")
print("   6. Try in incognito mode")
