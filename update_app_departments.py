"""
Script to update existing applications with department field from scholar profiles
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "demo")

async def update_applications_with_department():
    client = AsyncIOMotorClient(MONGODB_URL)
    db = client[DATABASE_NAME]
    
    users_collection = db.users
    applications_collection = db.applications
    
    print("🔄 Updating applications with department information...")
    
    # Find all applications
    applications = await applications_collection.find({}).to_list(length=None)
    
    updated_count = 0
    for app in applications:
        # Get scholar's user profile
        scholar = await users_collection.find_one({"_id": app["scholar_id"]})
        
        if scholar and scholar.get("department"):
            # Update application with department
            result = await applications_collection.update_one(
                {"_id": app["_id"]},
                {"$set": {"department": scholar["department"]}}
            )
            
            if result.modified_count > 0:
                updated_count += 1
                print(f"✅ Updated {app['registration_id']} with department: {scholar['department']}")
        else:
            print(f"⚠️  No department found for scholar: {app.get('scholar_name', 'Unknown')}")
    
    print(f"\n✅ Updated {updated_count} applications with department information")
    
    client.close()

if __name__ == "__main__":
    asyncio.run(update_applications_with_department())
