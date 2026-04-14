from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, validator
from typing import Optional, List
from datetime import datetime
import os
from dotenv import load_dotenv
import shutil
from pathlib import Path

load_dotenv()

app = FastAPI(title="PhD Scholar Registration System")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL")
client = AsyncIOMotorClient(MONGODB_URL)
db = client["Phd_admission"]
scholars_collection = db["scholars"]

# Upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Pydantic models
class PersonalDetails(BaseModel):
    full_name: str
    date_of_birth: str
    gender: str
    nationality: str
    category: str
    aadhaar_passport: str
    mobile: str
    email: EmailStr
    permanent_address: str
    communication_address: str

class AcademicUG(BaseModel):
    degree_name: str
    college_university: str
    branch_department: str
    year_of_passing: str
    cgpa_percentage: str

class AcademicPG(BaseModel):
    degree_name: Optional[str] = None
    college_university: Optional[str] = None
    specialization: Optional[str] = None
    year_of_passing: Optional[str] = None
    cgpa_percentage: Optional[str] = None

class EntranceExam(BaseModel):
    exam_name: str
    registration_number: str
    year_of_exam: str
    score_rank: str
    validity_period: str

class ResearchInfo(BaseModel):
    area_of_interest: str
    proposed_topic: str
    statement_of_purpose: str
    preferred_supervisor: str
    previous_research: Optional[str] = None
    publications: Optional[str] = None

class WorkExperience(BaseModel):
    company_name: Optional[str] = None
    job_role: Optional[str] = None
    years_of_experience: Optional[str] = None
    field_of_work: Optional[str] = None

class ScholarRegistration(BaseModel):
    personal_details: PersonalDetails
    ug_details: AcademicUG
    pg_details: Optional[AcademicPG] = None
    entrance_exam: EntranceExam
    research_info: ResearchInfo
    work_experience: Optional[WorkExperience] = None
    declaration_agreed: bool
    digital_signature: str
    submission_date: str

@app.get("/")
async def root():
    return {"message": "PhD Scholar Registration API", "status": "active"}

@app.post("/api/upload-file")
async def upload_file(file: UploadFile = File(...), field_name: str = Form(...)):
    try:
        # Create unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = os.path.splitext(file.filename)[1]
        unique_filename = f"{field_name}_{timestamp}{file_extension}"
        file_path = UPLOAD_DIR / unique_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "File uploaded successfully",
                "filename": unique_filename,
                "field_name": field_name
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

@app.post("/api/register")
async def register_scholar(registration: ScholarRegistration):
    try:
        # Add metadata
        registration_dict = registration.dict()
        registration_dict["created_at"] = datetime.now().isoformat()
        registration_dict["registration_id"] = f"PHD{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        # Insert into MongoDB
        result = await scholars_collection.insert_one(registration_dict)
        
        return JSONResponse(
            status_code=201,
            content={
                "message": "Registration successful",
                "registration_id": registration_dict["registration_id"],
                "id": str(result.inserted_id)
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

@app.get("/api/scholars")
async def get_scholars(skip: int = 0, limit: int = 10):
    try:
        scholars = []
        cursor = scholars_collection.find().skip(skip).limit(limit)
        async for document in cursor:
            document["_id"] = str(document["_id"])
            scholars.append(document)
        
        total = await scholars_collection.count_documents({})
        
        return {
            "scholars": scholars,
            "total": total,
            "skip": skip,
            "limit": limit
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch scholars: {str(e)}")

@app.get("/api/scholar/{registration_id}")
async def get_scholar(registration_id: str):
    try:
        scholar = await scholars_collection.find_one({"registration_id": registration_id})
        if scholar:
            scholar["_id"] = str(scholar["_id"])
            return scholar
        else:
            raise HTTPException(status_code=404, detail="Scholar not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch scholar: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
