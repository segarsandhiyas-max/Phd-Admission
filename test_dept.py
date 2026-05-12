import asyncio, sys, os
from dotenv import load_dotenv

sys.path.append('backend')
from motor.motor_asyncio import AsyncIOMotorClient
from main import get_application_department, VISVESVARAYA_SCHEME_CONFIG

load_dotenv('backend/.env')
uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(uri)
db = client.get_database(os.getenv('DATABASE_NAME', 'phd_admission_system'))

async def main():
    apps = await db.applications.find({'department': 'Computer Science', 'finalScore': {'$ne': None}}).to_list(None)
    for doc in apps:
        name = doc.get('personal_details', {}).get('name') or doc.get('name')
        dept = get_application_department(doc)
        print(f"Name: {name}, Dept: {repr(dept)}")
        seats = VISVESVARAYA_SCHEME_CONFIG.get("department_seats", {}).get(dept, 0)
        print(f"Seats assigned for this dept: {seats}")

asyncio.run(main())
