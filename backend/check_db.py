import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    # Check all admission_confirmed candidates
    apps = await db.applications.find({
        "status": {"$in": ["admission_confirmed", "final_approved", "dean_approved", "interview_completed"]}
    }).to_list(length=100)
    
    for app in apps:
        if "Computer Science" in str(app.get('department')) or "ECE" in str(app.get('department')) or "Electronics" in str(app.get('department')):
            print(f"[{app.get('registration_id')}] Status: {app.get('status')} | CandStatus: {app.get('candidateStatus')} | Rank: {app.get('finalRank')} | Score: {app.get('finalScore')} | Dept: {app.get('department')} | SeatAlloc: {app.get('seatAllocationStatus')} | Name: {app.get('scholar_name') or app.get('personal_details', {}).get('full_name')}")

if __name__ == "__main__":
    asyncio.run(main())
