import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_rejections():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    names = ["shiva", "keshav"]
    for name in names:
        doc = await db.applications.find_one({"personal_details.full_name": {"$regex": name, "$options": "i"}})
        if doc:
            print(f"{name}:")
            print(f"  candidateStatus: {doc.get('candidateStatus')}")
            print(f"  status: {doc.get('status')}")
            print(f"  finalScore: {doc.get('finalScore')}")
            print(f"  interviewMarks: {doc.get('interviewMarks')}")
            print(f"  Waitlist/Reject info: {doc.get('review_status')}")

if __name__ == "__main__":
    asyncio.run(check_rejections())
