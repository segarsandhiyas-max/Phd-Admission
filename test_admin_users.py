import requests
import json

BASE_URL = 'http://localhost:8000'

print("=" * 60)
print("TEST: Admin Users with Department and Phone")
print("=" * 60)

try:
    # Register a faculty user with department and phone
    print("\n1. Registering Faculty user with Department and Phone...")
    faculty_response = requests.post(f'{BASE_URL}/api/register', json={
        'email': 'dr_sharma@example.com',
        'full_name': 'Dr. Sharma',
        'password': 'password123',
        'role': 'faculty',
        'department': 'Computer Science',
        'phone': '9876543210'
    })
    
    faculty_data = faculty_response.json()
    print(f"Status: {faculty_response.status_code}")
    print(f"Faculty Response: {json.dumps(faculty_data, indent=2)}")
    
    # Register an admin with department and phone
    print("\n2. Registering Admin user with Department and Phone...")
    admin_response = requests.post(f'{BASE_URL}/api/register', json={
        'email': 'admin_test@example.com',
        'full_name': 'Admin Test User',
        'password': 'password123',
        'role': 'admin',
        'department': 'Administration',
        'phone': '9123456789'
    })
    
    admin_data = admin_response.json()
    print(f"Status: {admin_response.status_code}")
    print(f"Admin Response: {json.dumps(admin_data, indent=2)}")
    
    # Login as admin
    print("\n3. Logging in as admin...")
    login_response = requests.post(f'{BASE_URL}/api/login', data={
        'username': 'admin_test@example.com',
        'password': 'password123'
    })
    
    login_data = login_response.json()
    print(f"Status: {login_response.status_code}")
    
    if login_response.status_code == 200:
        token = login_data['access_token']
        print(f"✅ Admin logged in successfully")
        
        # Fetch all users
        print("\n4. Fetching all users from API...")
        users_response = requests.get(
            f'{BASE_URL}/api/admin/users',
            headers={'Authorization': f'Bearer {token}'}
        )
        
        users_data = users_response.json()
        print(f"Status: {users_response.status_code}")
        
        if users_response.status_code == 200:
            print(f"\n✅ Users fetched: Total = {users_data['total']}")
            print("\nUsers returned from API:")
            for user in users_data['users']:
                print(f"\n  User ID: {user.get('id')}")
                print(f"  Name: {user.get('full_name')}")
                print(f"  Email: {user.get('email')}")
                print(f"  Role: {user.get('role')}")
                print(f"  Department: {user.get('department')}")
                print(f"  Phone: {user.get('phone')}")
                print(f"  Active: {user.get('is_active')}")
                print(f"  Created: {user.get('created_at')}")
        else:
            print(f"❌ Error fetching users: {users_data}")
    else:
        print(f"❌ Login failed: {login_data}")

except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()

print("\n" + "=" * 60)
