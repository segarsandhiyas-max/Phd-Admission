import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def fix_db():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    apps = await db.applications.find({
        "status": {"$in": ["admission_confirmed", "final_approved", "dean_approved", "interview_completed"]}
    }).to_list(length=1000)
    
    count = 0
    for app in apps:
        if app.get("candidateStatus") == "Qualified for Ranking":
            # Since they are past interview, they should be "Ranked" if they have finalScore, else "Interview Completed"
            new_status = "Ranked" if app.get("finalScore") is not None else "Interview Completed"
            await db.applications.update_one(
                {"_id": app["_id"]},
                {"$set": {"candidateStatus": new_status}}
            )
            print(f"Fixed {app.get('registration_id')} -> {new_status}")
            count += 1
            
    print(f"Fixed {count} records.")

if __name__ == "__main__":
    asyncio.run(fix_db())
