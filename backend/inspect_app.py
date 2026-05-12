import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    # Find one with entranceMarks
    app = await db.applications.find_one({'entranceMarks': {'$ne': None}})
    if app:
        print("Keys in application:", app.keys())
        print("entranceMarks:", app.get('entranceMarks'))
        print("correctAnswers:", app.get('correctAnswers'))
        print("wrongAnswers:", app.get('wrongAnswers'))
    else:
        print("No application with entranceMarks found.")

if __name__ == "__main__":
    asyncio.run(main())
