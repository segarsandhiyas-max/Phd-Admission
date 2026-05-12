import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    cursor = db.applications.find({'entranceMarks': {'$ne': None}}, {'entranceMarks': 1, 'registration_id': 1})
    async for app in cursor:
        print(f"{app.get('registration_id')}: {app.get('entrance_marks')} / {app.get('entranceMarks')}")

if __name__ == "__main__":
    asyncio.run(main())
