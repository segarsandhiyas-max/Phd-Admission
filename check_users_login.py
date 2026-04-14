#!/usr/bin/env python3
"""
Script to check users in the database and test login credentials
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
import os
from dotenv import load_dotenv

load_dotenv()

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")

async def check_users():
    MONGODB_URL = os.getenv("MONGODB_URL")
    DATABASE_NAME = os.getenv("DATABASE_NAME", "demo")
    
    print(f"🔍 Connecting to MongoDB...")
    print(f"   Database: {DATABASE_NAME}")
    
    client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
    db = client[DATABASE_NAME]
    users_collection = db["users"]
    
    # Get all users
    users = await users_collection.find({}).to_list(length=None)
    
    print(f"\n📊 Found {len(users)} users in database:\n")
    print("=" * 80)
    
    for user in users:
        print(f"ID: {user.get('_id')}")
        print(f"Email: {user.get('email')}")
        print(f"Full Name: {user.get('full_name')}")
        print(f"Role: {user.get('role')}")
        print(f"Department: {user.get('department')}")
        print(f"Active: {user.get('is_active', True)}")
        print(f"Created: {user.get('created_at')}")
        
        # Check if password hash exists
        if 'hashed_password' in user:
            print(f"Password Hash: {user['hashed_password'][:50]}...")
            
            # Try common passwords
            test_passwords = [
                'admin@123',
                'scholar@123', 
                'faculty@123',
                'director@123',
                'dean@123',
                user.get('email'),  # sometimes email is the password
                '123456',
                'password'
            ]
            
            for test_pwd in test_passwords:
                try:
                    if pwd_context.verify(test_pwd, user['hashed_password']):
                        print(f"✅ PASSWORD FOUND: '{test_pwd}'")
                        break
                except Exception as e:
                    pass
        else:
            print("⚠️ No password hash found!")
        
        print("-" * 80)
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_users())
