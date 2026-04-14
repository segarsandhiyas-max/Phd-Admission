#!/usr/bin/env python3
import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError
import sys

# Register a new scholar
register_data = {
    'email': 'testscholar2@example.com',
    'password': 'abc123',
    'full_name': 'Test Scholar 2',
    'role': 'scholar'
}

print("Step 1: Register Scholar")

try:
    req = Request(
        'http://localhost:8000/api/register',
        method='POST',
        data=json.dumps(register_data).encode(),
        headers={'Content-Type': 'application/json'}
    )
    r = urlopen(req)
    user_response = json.loads(r.read().decode())
    print("SUCCESS: Scholar registered")
    print("User ID:", user_response['id'])
except HTTPError as e:
    error_body = e.read().decode()
    print(f"FAILED: HTTP {e.code}")
    print("Error:", error_body)
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    sys.exit(1)

print("\nStep 2: Login Scholar")

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
    token = login_response['access_token']
    print("SUCCESS: Scholar logged in")
except HTTPError as e:
    print(f"FAILED: HTTP {e.code}")
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

print("\nStep 3: Submit Application")

application_data = {
    'personal_details': {
        'full_name': 'Test Scholar',
        'date_of_birth': '1990-01-15',
        'gender': 'Male',
        'nationality': 'Indian',
        'category': 'OC',
        'aadhaar_passport': 'A123456789',
        'mobile': '9876543210',
        'email': 'testscholar2@example.com',
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
    print("SUCCESS: Application submitted")
    print("Registration ID:", app_response.get('registration_id'))
except HTTPError as e:
    error_body = e.read().decode()
    print(f"FAILED: HTTP {e.code}")
    print("Error:", error_body)
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)

print("\nStep 4: Fetch My Applications")

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
    print("SUCCESS: Applications fetched")
    print("Total applications:", apps_response['total'])
    if apps_response['total'] > 0:
        print("First application status:", apps_response['applications'][0]['status'])
    else:
        print("ERROR: No applications found!")
except HTTPError as e:
    error_body = e.read().decode()
    print(f"FAILED: HTTP {e.code}")
    print("Error:", error_body)
    print("\nFull Response:")
    print(error_body)
    sys.exit(1)
except Exception as e:
    print(f"ERROR: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("\nStep 5: Try Another Application (Should Fail)")

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
    print("ERROR: Second application should have been rejected!")
except HTTPError as e:
    if e.code == 400:
        error_body = json.loads(e.read().decode())
        print("SUCCESS: Correctly rejected second application")
        print("Error message:", error_body.get('detail'))
    else:
        print(f"FAILED: Unexpected HTTP {e.code}")
except Exception as e:
    print(f"ERROR: {e}")

print("\nAll tests completed successfully!")
