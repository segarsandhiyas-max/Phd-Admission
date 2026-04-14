"""Check what collections exist in MongoDB demo database"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv('backend/.env')

async def check():
    MONGODB_URL = os.getenv('MONGODB_URL')
    DATABASE_NAME = os.getenv('DATABASE_NAME', 'demo')
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    collections = await db.list_collection_names()
    print(f'\n📁 Collections in "{DATABASE_NAME}" database:')
    
    if not collections:
        print('  ❌ No collections yet - database is empty!')
        print('  💡 Register a user or submit an application to create collections')
    else:
        for col in collections:
            count = await db[col].count_documents({})
            print(f'  ✅ {col}: {count} document(s)')
            
            # Show sample data
            if count > 0:
                sample = await db[col].find_one({})
                if sample:
                    print(f'     Sample fields: {list(sample.keys())}')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check())
