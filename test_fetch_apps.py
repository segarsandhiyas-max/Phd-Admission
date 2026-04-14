#!/usr/bin/env python3
import json
from urllib.request import urlopen, Request
from urllib.error import HTTPError

token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJzY2hvbGFyXzIwMjYwMjE3MjA1MjMxMzkyNTAwIiwicm9sZSI6InNjaG9sYXIiLCJleHAiOjE3NzE1MzQ5NTV9.E-_REKIkh9Kb7vZNfU6g0g701Ov5C0YEPVQ7ZUc0Dps'

try:
    req = Request(
        'http://localhost:8000/api/scholar/my-applications',
        method='GET',
        headers={'Authorization': f'Bearer {token}'}
    )
    r = urlopen(req)
    response = json.loads(r.read().decode())
    print(json.dumps(response, indent=2, default=str))
except HTTPError as e:
    print(f"HTTP Error {e.code}: {e.reason}")
    print(e.read().decode())
except Exception as e:
    print(f"Error: {type(e).__name__}: {e}")
