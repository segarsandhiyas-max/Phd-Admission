import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
import sys
import os
from datetime import datetime

# Define helper functions locally to avoid main.py import issues
def get_application_department(application_doc) -> str:
    app_department = (application_doc.get("department") or "").strip()
    fallback_department = ((application_doc.get("ug_details") or {}).get("branch_department") or "").strip()
    return app_department or fallback_department

def departments_match(dept1, dept2):
    return (dept1 or "").strip().lower() == (dept2 or "").strip().lower()

async def recalculate_department_entrance_ranks_local(db, department: str) -> None:
    normalized_department = (department or "").strip()
    if not normalized_department:
        return

    dept_apps = []
    cursor = db.applications.find({
        "entranceMarks": {"$ne": None},
        "attendanceStatus": "Present"
    })
    async for doc in cursor:
        doc_department = get_application_department(doc)
        if departments_match(normalized_department, doc_department):
            dept_apps.append(doc)

    if not dept_apps:
        return

    marks_list = [float(app.get("entranceMarks") or 0) for app in dept_apps]
    score_max = max(marks_list)
    score_min = min(marks_list)
    score_threshold = round(score_max - score_min, 4)
    print(f"[{normalized_department}] Max: {score_max}, Min: {score_min}, Threshold: {score_threshold}")

    qualified_docs = []
    for app in dept_apps:
        marks = float(app.get("entranceMarks") or 0)
        is_qualified = marks >= score_threshold
        
        await db.applications.update_one(
            {"_id": app["_id"]},
            {"$set": {
                "qualified": is_qualified,
                "candidateStatus": "Qualified for Ranking" if is_qualified else "Rejected",
                "updated_at": datetime.utcnow()
            }}
        )
        
        if is_qualified:
            app["qualified"] = True
            qualified_docs.append(app)

    qualified_docs.sort(
        key=lambda doc: (
            -float(doc.get("entranceMarks") or 0),
            str(doc.get("created_at") or ""),
            str(doc.get("_id") or ""),
        )
    )

    for index, doc in enumerate(qualified_docs):
        await db.applications.update_one(
            {"_id": doc["_id"]},
            {"$set": {"entranceRank": index + 1, "updated_at": datetime.utcnow()}}
        )

    reset_cursor = db.applications.find({
        "qualified": {"$ne": True},
        "entranceRank": {"$ne": None}
    })
    async for doc in reset_cursor:
        doc_department = get_application_department(doc)
        if departments_match(normalized_department, doc_department):
            await db.applications.update_one(
                {"_id": doc["_id"]},
                {"$set": {"entranceRank": None, "updated_at": datetime.utcnow()}}
            )

async def main():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client['demo']
    
    depts = await db.applications.distinct("department")
    for d in depts:
        if d:
            print(f"Fixing qualification for {d}")
            await recalculate_department_entrance_ranks_local(db, d)
    print("Done")

if __name__ == "__main__":
    asyncio.run(main())
