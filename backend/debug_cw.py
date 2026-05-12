import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    apps = await db.applications.find({'entranceMarks': {'$ne': None}}).to_list(None)
    for app in apps:
        print(f"{app.get('registration_id')}: C={app.get('correctAnswers')}, W={app.get('wrongAnswers')}, Marks={app.get('entranceMarks')}")

if __name__ == "__main__":
    asyncio.run(main())
