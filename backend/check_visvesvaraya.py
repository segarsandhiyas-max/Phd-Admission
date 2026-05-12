"""
Quick check: Did Visvesvaraya seat allocation work?
Run: python check_visvesvaraya.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
DB_NAME   = os.getenv("DB_NAME", "phd_admission")

async def main():
    client = AsyncIOMotorClient(MONGO_URI)
    db = client[DB_NAME]
    col = db["applications"]

    vis_count   = await col.count_documents({"seatType": "VISVESVARAYA"})
    merit_count = await col.count_documents({"seatType": "MERIT"})
    not_sel     = await col.count_documents({"seatAllocationStatus": "Not Selected"})
    total_alloc = await col.count_documents({"seatAllocationStatus": "Seat Allocated"})

    print("=" * 50)
    print("  VISVESVARAYA SEAT ALLOCATION REPORT")
    print("=" * 50)
    print(f"  VISVESVARAYA allocated : {vis_count}")
    print(f"  MERIT allocated        : {merit_count}")
    print(f"  Total allocated        : {total_alloc}")
    print(f"  Not Selected           : {not_sel}")
    print("=" * 50)

    if vis_count > 0:
        print("\n  VISVESVARAYA Candidates:")
        async for doc in col.find({"seatType": "VISVESVARAYA"}):
            name = (doc.get("full_name")
                    or doc.get("name")
                    or (doc.get("personal_details") or {}).get("full_name")
                    or "N/A")
            dept   = doc.get("department", "N/A")
            status = doc.get("seatAllocationStatus", "N/A")
            rank   = doc.get("finalRank", "N/A")
            print(f"    Name: {name} | Dept: {dept} | Rank: {rank} | Status: {status}")
        print()
        print("  RESULT: Visvesvaraya seat allocation WORKED correctly.")
    else:
        print("\n  RESULT: No Visvesvaraya seats allocated.")
        print("  Fallback to MERIT was applied (unused seats moved to MERIT pool).")
        print("  Possible reasons:")
        print("    - No candidate had department in eligible list (CSE/IT/ECE etc.)")
        print("    - admission_status field was missing (check terminal logs)")
        print("    - Seat allocation not run yet from the dashboard")

asyncio.run(main())
