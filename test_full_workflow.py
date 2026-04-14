#!/usr/bin/env python3
import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError

# First, register a new scholar
register_data = {
    'email': 'testscholar@example.com',
    'password': 'abc123',
    'full_name': 'Test Scholar',
    'role': 'scholar'
}

print("=" * 60)
print("Step 1: Register Scholar")
print("=" * 60)

try:
    req = Request(
        'http://localhost:8000/api/register',
        method='POST',
        data=json.dumps(register_data).encode(),
        headers={'Content-Type': 'application/json'}
    )
    r = urlopen(req)
    user_response = json.loads(r.read().decode())
    print("✅ Scholar registered successfully:")
    print(json.dumps(user_response, indent=2, default=str))
    user_id = user_response['id']
    token = None
except Exception as e:
    print(f"❌ Registration failed: {e}")
    exit(1)

print("\n" + "=" * 60)
print("Step 2: Login Scholar")
print("=" * 60)

from urllib.parse import urlencode

login_data = urlencode({
    'username': register_data['email'],
    'password': register_data['password']
}).encode()

try:
    req = Request(
        'http://localhost:8000/api/login',
        method='POST',
        data=login_data,
        headers={'Content-Type': 'application/x-www-form-urlencoded'}
    )
    r = urlopen(req)
    login_response = json.loads(r.read().decode())
    print("✅ Scholar logged in successfully:")
    token = login_response['access_token']
    print(f"Token: {token[:50]}...")
except Exception as e:
    print(f"❌ Login failed: {e}")
    exit(1)

print("\n" + "=" * 60)
print("Step 3: Submit Application")
print("=" * 60)

application_data = {
    'personal_details': {
        'full_name': 'Test Scholar',
        'date_of_birth': '1990-01-15',
        'gender': 'Male',
        'nationality': 'Indian',
        'category': 'OC',
        'aadhaar_passport': 'A123456789',
        'mobile': '9876543210',
        'email': 'testscholar@example.com',
        'permanent_address': '123 Main St',
        'communication_address': '456 Test Ave'
    },
    'ug_details': {
        'degree_name': 'B.Tech',
        'college_university': 'IIT Delhi',
        'branch_department': 'CS',
        'year_of_passing': '2020',
        'cgpa_percentage': '8.5'
    },
    'pg_details': None,
    'entrance_exam': {
        'exam_name': 'GATE',
        'registration_number': 'GT123456',
        'year_of_exam': '2021',
        'score_rank': '500',
        'validity_period': '3 years'
    },
    'research_info': {
        'area_of_interest': 'Machine Learning',
        'proposed_topic': 'Deep Learning Applications',
        'statement_of_purpose': 'Pursuing PhD in ML',
        'preferred_supervisor': 'Dr. Smith',
        'previous_research': None,
        'publications': None
    },
    'work_experience': None,
    'uploaded_files': {}
}

try:
    req = Request(
        'http://localhost:8000/api/scholar/application',
        method='POST',
        data=json.dumps(application_data).encode(),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    r = urlopen(req)
    app_response = json.loads(r.read().decode())
    print("✅ Application submitted successfully:")
    print(json.dumps(app_response, indent=2, default=str))
    registration_id = app_response.get('registration_id')
except HTTPError as e:
    error_body = e.read().decode()
    print(f"❌ Application submission failed: {e.code}")
    print(f"Error: {error_body}")
    exit(1)
except Exception as e:
    print(f"❌ Error: {e}")
    exit(1)

print("\n" + "=" * 60)
print("Step 4: Fetch My Applications")
print("=" * 60)

try:
    req = Request(
        'http://localhost:8000/api/scholar/my-applications',
        method='GET',
        headers={
            'Authorization': f'Bearer {token}'
        }
    )
    r = urlopen(req)
    apps_response = json.loads(r.read().decode())
    print("✅ Applications fetched successfully:")
    print(json.dumps(apps_response, indent=2, default=str))
    print(f"\n✅ Total applications: {apps_response['total']}")
    if apps_response['total'] > 0:
        print(f"✅ First application status: {apps_response['applications'][0]['status']}")
except Exception as e:
    print(f"❌ Error fetching applications: {e}")
    exit(1)

print("\n" + "=" * 60)
print("Step 5: Try to Submit Another Application (Should Fail)")
print("=" * 60)

try:
    req = Request(
        'http://localhost:8000/api/scholar/application',
        method='POST',
        data=json.dumps(application_data).encode(),
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {token}'
        }
    )
    r = urlopen(req)
    print("❌ ERROR: Second application should have been rejected!")
except HTTPError as e:
    error_body = e.read().decode()
    if e.code == 400:
        error_msg = json.loads(error_body).get('detail')
        print(f"✅ Correctly rejected second application:")
        print(f"   Error: {error_msg}")
    else:
        print(f"❌ Unexpected error: {e.code}")
        print(f"   Error: {error_body}")
except Exception as e:
    print(f"❌ Error: {e}")
