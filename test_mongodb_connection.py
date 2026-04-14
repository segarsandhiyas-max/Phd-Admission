"""
Quick MongoDB Connection Test
Run this after adding your IP to MongoDB Atlas whitelist
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv('backend/.env')

async def test_connection():
    MONGODB_URL = os.getenv('MONGODB_URL')
    DATABASE_NAME = os.getenv('DATABASE_NAME', 'demo')
   
    print(f"🔗 Testing connection to: {MONGODB_URL[:50]}...")
    print(f"📚 Database: {DATABASE_NAME}\n")
    
    try:
        # Create client
        client = AsyncIOMotorClient(MONGODB_URL, serverSelectionTimeoutMS=10000)
        
        # Try to connect
        await client.admin.command('ping')
        
        print("✅ SUCCESS! Connected to MongoDB successfully!")
        print(f"📊 Server Info: {await client.server_info()}\n")
        
        # Test database access
        db = client[DATABASE_NAME]
        collections = await db.list_collection_names()
        print(f"📁 Collections in '{DATABASE_NAME}': {collections if collections else '(empty - will be created on first insert)'}")
        
        client.close()
        return True
        
    except Exception as e:
        print(f"❌ FAILED: {str(e)}\n")
        print("💡 If you see SSL errors, make sure your IP is whitelisted in MongoDB Atlas:")
        print("   1. Go to https://cloud.mongodb.com/")
        print("   2. Network Access → Add IP Address")
        print("   3. Add 0.0.0.0/0 (allow all) or your current IP")
        print("   4. Wait 2-3 minutes for changes to apply")
        return False

if __name__ == "__main__":
    asyncio.run(test_connection())
