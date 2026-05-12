import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

async def check_cse():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    cse_aliases = ["CSE", "Computer Science", "Computer Science and Engineering"]
    
    print("Checking CSE scholars...")
    cursor = db.applications.find({"department": {"$in": cse_aliases}})
    
    total = 0
    has_interview = 0
    has_final = 0
    ranked = 0
    
    async for doc in cursor:
        total += 1
        name = doc.get("personal_details", {}).get("full_name") or doc.get("scholar_name")
        status = doc.get("candidateStatus")
        int_marks = doc.get("interviewMarks")
        fin_score = doc.get("finalScore")
        
        print(f"- {name}: Status={status}, Interview={int_marks}, Final={fin_score}")
        
        if int_marks is not None: has_interview += 1
        if fin_score is not None: has_final += 1
        if status == "Ranked": ranked += 1
        
    print(f"\nTotal CSE: {total}")
    print(f"Has Interview Marks: {has_interview}")
    print(f"Has Final Score: {has_final}")
    print(f"Is Ranked: {ranked}")

if __name__ == "__main__":
    asyncio.run(check_cse())
