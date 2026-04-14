"""Check GridFS files in MongoDB"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from dotenv import load_dotenv
import os

load_dotenv('backend/.env')

async def check_files():
    MONGODB_URL = os.getenv('MONGODB_URL')
    DATABASE_NAME = os.getenv('DATABASE_NAME', 'demo')
    
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    print(f'\n📁 All Collections in "{DATABASE_NAME}" database:')
    collections = await db.list_collection_names()
    for col in collections:
        count = await db[col].count_documents({})
        print(f'  - {col}: {count} document(s)')
    
    print(f'\n📎 Checking GridFS Files:')
    
    # Check fs.files collection (file metadata)
    files_col = db['fs.files']
    file_count = await files_col.count_documents({})
    
    if file_count == 0:
        print('  ❌ No files uploaded yet!')
        print('  💡 Upload a document through your application to see it here')
    else:
        print(f'  ✅ Found {file_count} uploaded file(s)\n')
        
        async for file_doc in files_col.find({}):
            print(f'  📄 File: {file_doc.get("filename", "unknown")}')
            print(f'     ID: {file_doc.get("_id")}')
            print(f'     Size: {file_doc.get("length", 0)} bytes')
            print(f'     Upload Date: {file_doc.get("uploadDate")}')
            if 'metadata' in file_doc:
                print(f'     Metadata: {file_doc["metadata"]}')
            print()
    
    # Check fs.chunks collection (file data)
    chunks_col = db['fs.chunks']
    chunk_count = await chunks_col.count_documents({})
    print(f'  📦 Total file chunks stored: {chunk_count}')
    
    client.close()

if __name__ == "__main__":
    asyncio.run(check_files())
