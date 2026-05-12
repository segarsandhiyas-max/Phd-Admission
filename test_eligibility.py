import asyncio, sys, os
from dotenv import load_dotenv

sys.path.append('backend')
from motor.motor_asyncio import AsyncIOMotorClient
from main import is_eligible_for_visvesvaraya, VISVESVARAYA_SCHEME_CONFIG

load_dotenv('backend/.env')
uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(uri)
db = client.get_database(os.getenv('DATABASE_NAME', 'phd_admission_system'))

async def main():
    apps = await db.applications.find({'department': 'Computer Science', 'finalScore': {'$ne': None}}).to_list(None)
    for a in apps:
        # Simulate auto-fix
        if not a.get("status"): a["status"] = "admission_confirmed"
        if a.get("is_new_phd") is None: a["is_new_phd"] = True
        if a.get("has_other_fellowship") is None: a["has_other_fellowship"] = False
        if a.get("apply_vish") is None: a["apply_vish"] = False
        
        name = a.get('personal_details', {}).get('name') or a.get('name')
        print(f"--- Checking {name} ---")
        eligible = is_eligible_for_visvesvaraya(a, "Computer Science")
        print(f"Eligible: {eligible}")

asyncio.run(main())
