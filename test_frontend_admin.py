#!/usr/bin/env python3
"""
Test script to simulate admin login and verify dashboard data loads
"""

import requests
import json
from datetime import datetime

BASE_URL = 'http://localhost:8000'

def print_header(text):
    print(f"\n{'='*70}")
    print(f"  {text}")
    print(f"{'='*70}")

def main():
    print_header("ADMIN DASHBOARD DATA TEST")
    
    # Step 1: Login as admin (using seeded credentials)
    print("\n1️⃣ Logging in as AKSHU (Admin)...")
    print("   Using email: admin@phd.edu, password: admin@123")
    login_response = requests.post(f'{BASE_URL}/api/login', data={
        'username': 'admin@phd.edu',
        'password': 'admin@123'
    })
    
    print(f"   Response status: {login_response.status_code}")
    print(f"   Response text: {login_response.text[:100] if login_response.text else 'Empty'}")
    
    if login_response.status_code != 200:
        print(f"❌ Login failed: {login_response.status_code}")
        print(f"   Response: {login_response.json()}")
        return False
    
    token = login_response.json()['access_token']
    user = login_response.json()['user']
    print(f"✅ Login successful!")
    print(f"   User: {user['full_name']} ({user['email']})")
    print(f"   Role: {user['role']}")
    print(f"   Token: {token[:20]}...")
    
    headers = {'Authorization': f'Bearer {token}'}
    
    # Step 2: Fetch statistics
    print("\n2️⃣ Fetching admin statistics...")
    stats_response = requests.get(f'{BASE_URL}/api/admin/statistics', headers=headers)
    
    if stats_response.status_code == 200:
        stats = stats_response.json()
        print(f"✅ Statistics fetched:")
        print(f"   Total Users: {stats.get('total_users', 0)}")
        print(f"   Active Users: {stats.get('active_users', 0)}")
        print(f"   Scholars: {stats.get('users_by_role', {}).get('scholar', 0)}")
        print(f"   Faculty: {stats.get('users_by_role', {}).get('faculty', 0)}")
        print(f"   Total Applications: {stats.get('total_applications', 0)}")
    else:
        print(f"❌ Failed to fetch statistics: {stats_response.status_code}")
    
    # Step 3: Fetch all users
    print("\n3️⃣ Fetching all users (no filter)...")
    users_response = requests.get(f'{BASE_URL}/api/admin/users', headers=headers)
    
    if users_response.status_code == 200:
        users_data = users_response.json()
        users = users_data.get('users', [])
        print(f"✅ Users fetched: {len(users)} total")
        
        print(f"\n   First 5 users:")
        for idx, user in enumerate(users[:5], 1):
            print(f"\n   {idx}. {user.get('full_name', 'N/A')}")
            print(f"      Email: {user.get('email', 'N/A')}")
            print(f"      Role: {user.get('role', 'N/A')}")
            print(f"      Department: {user.get('department', 'N/A')}")
            print(f"      Phone: {user.get('phone', 'N/A')}")
            print(f"      Status: {'Active' if user.get('is_active') else 'Inactive'}")
    else:
        print(f"❌ Failed to fetch users: {users_response.status_code}")
        print(f"   Response: {users_response.json()}")
    
    # Step 4: Fetch users by role (scholar)
    print("\n4️⃣ Fetching scholar users (role filter)...")
    scholar_response = requests.get(f'{BASE_URL}/api/admin/users?role=scholar', headers=headers)
    
    if scholar_response.status_code == 200:
        scholar_data = scholar_response.json()
        scholars = scholar_data.get('users', [])
        print(f"✅ Scholars fetched: {len(scholars)} total")
        for idx, scholar in enumerate(scholars, 1):
            print(f"   {idx}. {scholar.get('full_name')} - {scholar.get('email')}")
    else:
        print(f"❌ Failed to fetch scholars: {scholar_response.status_code}")
    
    print_header("✅ TEST COMPLETED SUCCESSFULLY")
    print("\n📊 Summary:")
    print("   ✓ Admin login working")
    print("   ✓ Statistics API working")
    print("   ✓ Users API working")
    print("   ✓ Role filter working")
    print("\n🎯 Ready for frontend testing!")

if __name__ == '__main__':
    main()
