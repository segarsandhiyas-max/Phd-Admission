import asyncio, sys, os
from dotenv import load_dotenv

sys.path.append('backend')
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv('backend/.env')
uri = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
client = AsyncIOMotorClient(uri)
db = client.get_database(os.getenv('DATABASE_NAME', 'phd_admission_system'))

async def main():
    apps = await db.applications.find({'department': 'Computer Science', 'finalScore': {'$ne': None}}).to_list(None)
    for a in apps:
        print(f"Name: {a.get('personal_details', {}).get('name')}, Seat: {a.get('seatType')}, FinalRank: {a.get('finalRank')}")
    print("Done")

asyncio.run(main())
