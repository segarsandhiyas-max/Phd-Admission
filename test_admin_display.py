#!/usr/bin/env python3
"""
Test script to verify Admin Dashboard displays user data correctly.
Creates fresh users with all fields (name, department, phone) properly filled.
"""

import requests
import sys

BASE_URL = 'http://localhost:8000'

def print_header(text):
    print(f"\n{'='*70}")
    print(f"  {text}")
    print(f"{'='*70}")

def print_subheader(text):
    print(f"\n📌 {text}")
    print("-" * 70)

def register_user(email, name, role, department='', phone=''):
    """Register a user with all fields"""
    print_subheader(f"Registering {role}: {name}")
    
    response = requests.post(f'{BASE_URL}/api/register', json={
        'email': email,
        'full_name': name,
        'password': 'Test@123',
        'role': role,
        'department': department or None,
        'phone': phone or None
    })
    
    if response.status_code == 200:
        data = response.json()
        print(f"✅ {role.upper()} Registered Successfully")
        print(f"   User ID: {data['id']}")
        print(f"   Name: {data['full_name']}")
        print(f"   Email: {data['email']}")
        print(f"   Department: {data.get('department', 'N/A')}")
        print(f"   Phone: {data.get('phone', 'N/A')}")
        return True
    else:
        print(f"❌ Registration Failed: {response.status_code}")
        print(f"   Error: {response.json().get('detail', 'Unknown error')}")
        return False

def login_user(email, password='Test@123'):
    """Login user and return token"""
    print_subheader(f"Logging in: {email}")
    
    response = requests.post(f'{BASE_URL}/api/login', data={
        'username': email,
        'password': password
    })
    
    if response.status_code == 200:
        data = response.json()
        token = data['access_token']
        user = data['user']
        print(f"✅ Login Successful")
        print(f"   Token obtained (first 20 chars): {token[:20]}...")
        print(f"   User Role: {user['role']}")
        return token
    else:
        print(f"❌ Login Failed: {response.status_code}")
        print(f"   Error: {response.json().get('detail', 'Unknown error')}")
        return None

def fetch_and_display_users(token):
    """Fetch and display all users"""
    print_subheader("Fetching Users from Admin API")
    
    response = requests.get(
        f'{BASE_URL}/api/admin/users',
        headers={'Authorization': f'Bearer {token}'}
    )
    
    if response.status_code == 200:
        data = response.json()
        users = data.get('users', [])
        
        print(f"✅ Users Fetched Successfully: Total = {data['total']}")
        print("\n📋 USER DETAILS:")
        print(f"{'NO.':<4} {'NAME':<25} {'ROLE':<12} {'DEPARTMENT':<25} {'PHONE':<15}")
        print("-" * 85)
        
        for idx, user in enumerate(users, 1):
            name = user.get('full_name') or '-'
            role = user.get('role', '-').upper()[:11]
            dept = user.get('department') or '-'
            phone = user.get('phone') or '-'
            
            print(f"{idx:<4} {name:<25} {role:<12} {dept:<25} {phone:<15}")
        
        return True
    else:
        print(f"❌ Failed to fetch users: {response.status_code}")
        print(f"   Error: {response.json()}")
        return False

def main():
    print_header("ADMIN DASHBOARD USER DATA TEST")
    print("Testing if user data (name, department, phone) displays correctly")
    
    try:
        # Step 1: Register multiple users with complete information
        print_header("STEP 1: REGISTERING USERS")
        
        users_to_register = [
            {
                'email': 'dr_sharma@test.com',
                'name': 'Dr. Sharma',
                'role': 'faculty',
                'department': 'Computer Science',
                'phone': '9876543210'
            },
            {
                'email': 'prof_verma@test.com',
                'name': 'Prof. Verma',
                'role': 'faculty',
                'department': 'Electrical Engineering',
                'phone': '9765432109'
            },
            {
                'email': 'director_kumar@test.com',
                'name': 'Dr. Kumar',
                'role': 'director',
                'department': 'Research',
                'phone': '9654321098'
            },
            {
                'email': 'dean_singh@test.com',
                'name': 'Dean Singh',
                'role': 'dean',
                'department': 'Academic Affairs',
                'phone': '9543210987'
            },
            {
                'email': 'admin_test@test.com',
                'name': 'Admin Test',
                'role': 'admin',
                'department': 'Administration',
                'phone': '9432109876'
            },
            {
                'email': 'scholar_raj@test.com',
                'name': 'Raj Kumar',
                'role': 'scholar',
                'department': 'CSE Division',
                'phone': '9321098765'
            }
        ]
        
        registration_count = 0
        for user_info in users_to_register:
            if register_user(**user_info):
                registration_count += 1
        
        print_header(f"REGISTRATION SUMMARY: {registration_count}/{len(users_to_register)} users registered")
        
        # Step 2: Login as admin
        print_header("STEP 2: LOGIN AS ADMIN")
        
        token = login_user('admin_test@test.com')
        
        if not token:
            print("\n❌ Cannot proceed - Admin login failed")
            return False
        
        # Step 3: Fetch and display users
        print_header("STEP 3: FETCHING AND DISPLAYING USERS")
        
        success = fetch_and_display_users(token)
        
        if success:
            print_header("✅ TEST COMPLETED SUCCESSFULLY")
            print("\n📊 VERIFICATION:")
            print("If all user names, departments, and phone numbers are visible above,")
            print("then the admin dashboard should display them correctly.")
            print("\n💡 EXPECTED BEHAVIOR IN ADMIN DASHBOARD:")
            print("   ✅ NAME column should show full names (not empty)")
            print("   ✅ DEPARTMENT column should show department values")
            print("   ✅ PHONE column should show phone numbers")
            print("   ✅ No fields should be empty (should show '-' if not provided)")
        else:
            print_header("❌ TEST FAILED")
        
        return success
        
    except Exception as e:
        print(f"\n❌ ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
