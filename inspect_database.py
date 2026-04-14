#!/usr/bin/env python3
"""
Direct database inspection script to debug user data storage and retrieval
"""

import asyncio
import json
from datetime import datetime
from pathlib import Path

# Add backend to path
import sys
sys.path.insert(0, r"d:\Phd project software engineering\backend")

# Import mock database
from mock_db import MockDatabase

async def inspect_database():
    """Directly inspect the mock database to see what's stored"""
    
    print("=" * 80)
    print("MOCK DATABASE INSPECTION")
    print("=" * 80)
    
    # Create mock database instance
    db = MockDatabase()
    users_collection = db["users"]
    
    print("\n1. Checking what's in the mock database...")
    print("-" * 80)
    
    # Try to get count
    count = await users_collection.count_documents({})
    print(f"✅ Total users in database: {count}")
    
    # Get all users
    all_users = []
    cursor = users_collection.find({})
    async for doc in cursor:
        all_users.append(doc)
    
    if not all_users:
        print("❌ No users found in database!")
        print("\n2. Creating test users...")
        print("-" * 80)
        
        # Insert test users
        test_users = [
            {
                "_id": "admin_test_001",
                "email": "admin@test.com",
                "full_name": "Admin Test User",
                "role": "admin",
                "department": "Administration",
                "phone": "9999999999",
                "hashed_password": "fake_hash",
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "_id": "faculty_test_001",
                "email": "faculty@test.com",
                "full_name": "Dr. Faculty",
                "role": "faculty",
                "department": "Computer Science",
                "phone": "8888888888",
                "hashed_password": "fake_hash",
                "is_active": True,
                "created_at": datetime.utcnow()
            }
        ]
        
        for user in test_users:
            await users_collection.insert_one(user)
            print(f"✅ Inserted: {user['email']} ({user['role']})")
        
        # Re-fetch
        all_users = []
        cursor = users_collection.find({})
        async for doc in cursor:
            all_users.append(doc)
    
    print(f"\n✅ Found {len(all_users)} users in database\n")
    
    if all_users:
        print("3. USER DATA IN DATABASE:")
        print("=" * 80)
        
        for idx, user in enumerate(all_users, 1):
            print(f"\nUser #{idx}:")
            print(f"  _id:         {user.get('_id', 'MISSING')}")
            print(f"  full_name:   {user.get('full_name', 'MISSING')}")
            print(f"  email:       {user.get('email', 'MISSING')}")
            print(f"  role:        {user.get('role', 'MISSING')}")
            print(f"  department:  {user.get('department', 'MISSING')}")
            print(f"  phone:       {user.get('phone', 'MISSING')}")
            print(f"  is_active:   {user.get('is_active', 'MISSING')}")
            print(f"  created_at:  {user.get('created_at', 'MISSING')}")
            print(f"  type(created_at): {type(user.get('created_at'))}")
        
        print("\n" + "=" * 80)
        print("4. SIMULATING API RESPONSE SERIALIZATION:")
        print("=" * 80)
        
        # Import serialize_document from main.py
        from main import serialize_document
        
        serialized_users = []
        for user in all_users:
            user_copy = dict(user)
            user_copy["id"] = user_copy.pop("_id")
            user_copy.pop("hashed_password", None)
            serialized = serialize_document(user_copy)
            serialized_users.append(serialized)
        
        print("\nAfter serialization (as sent to frontend):")
        print(json.dumps(serialized_users, indent=2, default=str))
        
        print("\n" + "=" * 80)
        print("5. FIELD CHECK:")
        print("=" * 80)
        
        for idx, user in enumerate(serialized_users, 1):
            full_name = user.get('full_name')
            email = user.get('email')
            dept = user.get('department')
            phone = user.get('phone')
            
            print(f"\nUser {idx} ({user.get('role')}):")
            print(f"  full_name present: {'✅ YES' if full_name else '❌ NO'} - Value: {full_name}")
            print(f"  email present:     {'✅ YES' if email else '❌ NO'} - Value: {email}")
            print(f"  department present:{'✅ YES' if dept is not None else '❌ NO'} - Value: {dept}")
            print(f"  phone present:     {'✅ YES' if phone else '❌ NO'} - Value: {phone}")

if __name__ == "__main__":
    print("Starting database inspection...\n")
    asyncio.run(inspect_database())
    print("\n✅ Inspection complete!")
