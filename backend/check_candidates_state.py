import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import os
from dotenv import load_dotenv

load_dotenv()

async def check_candidates():
    client = AsyncIOMotorClient(os.getenv("MONGODB_URL"))
    db = client[os.getenv("DATABASE_NAME", "demo")]
    applications = db["applications"]
    
    names = ["Harika", "Eniyan"]
    for name in names:
        print(f"--- Checking {name} ---")
        # Case insensitive search for name
        cursor = applications.find({"personal_details.full_name": {"$regex": name, "$options": "i"}})
        found = False
        async for app in cursor:
            found = True
            personal = app.get("personal_details", {})
            state = personal.get("candidate_state_type") or app.get("candidate_state_type")
            dept = app.get("department")
            print(f"Name: {personal.get('full_name')}")
            print(f"Department: {dept}")
            print(f"State Type: {state}")
            print(f"Category: {personal.get('category')}")
            print("-" * 20)
        if not found:
            print(f"No candidate found with name containing '{name}'")

if __name__ == "__main__":
    asyncio.run(check_candidates())
