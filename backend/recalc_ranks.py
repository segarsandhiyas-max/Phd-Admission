import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

def get_application_department(application_doc) -> str:
    app_department = (application_doc.get("department") or "").strip()
    fallback_department = ((application_doc.get("ug_details") or {}).get("branch_department") or "").strip()
    return app_department or fallback_department

def departments_match(dept1, dept2):
    return (dept1 or "").strip().lower() == (dept2 or "").strip().lower()

def is_interview_completed_candidate(candidate_status):
    normalized = str(candidate_status or "").strip().lower()
    return normalized in {"interview completed", "interview_completed"}

def is_ranked_candidate(candidate_status):
    normalized = str(candidate_status or "").strip().lower()
    return normalized in {"ranked", "qualified for ranking"}

async def recalc_all():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    depts = await db.applications.distinct("department")
    
    for department in depts:
        normalized_department = (department or "").strip()
        if not normalized_department:
            continue
            
        print(f"Recalculating {normalized_department}")
        eligible_docs = []
        cursor = db.applications.find({"interviewMarks": {"$ne": None}})
        async for doc in cursor:
            doc_department = get_application_department(doc)
            if not departments_match(normalized_department, doc_department):
                continue

            candidate_status = doc.get("candidateStatus")
            # We also include any currently Ranked candidates just to be safe
            if not (is_interview_completed_candidate(candidate_status) or is_ranked_candidate(candidate_status)):
                continue

            if doc.get("finalScore") is None:
                continue

            eligible_docs.append(doc)

        eligible_docs.sort(
            key=lambda doc: (
                -float(doc.get("finalScore") or 0),
                -float(doc.get("interviewMarks") or 0),
                -float(doc.get("entranceMarks") or 0),
                str(doc.get("created_at") or ""),
                str(doc.get("_id") or ""),
            )
        )

        from datetime import datetime
        for index, doc in enumerate(eligible_docs):
            await db.applications.update_one(
                {"_id": doc["_id"]},
                {
                    "$set": {
                        "finalRank": index + 1,
                        "candidateStatus": "Ranked",
                        "updated_at": datetime.utcnow(),
                    }
                }
            )

        # Clear stale final rank where final score is missing in this department.
        reset_cursor = db.applications.find({"finalRank": {"$ne": None}})
        async for doc in reset_cursor:
            doc_department = get_application_department(doc)
            if not departments_match(normalized_department, doc_department):
                continue

            candidate_status = doc.get("candidateStatus")
            if not (is_interview_completed_candidate(candidate_status) or is_ranked_candidate(candidate_status)):
                await db.applications.update_one(
                    {"_id": doc["_id"]},
                    {"$set": {"finalRank": None, "updated_at": datetime.utcnow()}}
                )
                
    print("Done recalculating final ranks!")

if __name__ == "__main__":
    asyncio.run(recalc_all())
