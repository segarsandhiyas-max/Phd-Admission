from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, timezone
from bson import ObjectId
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import JWTError, jwt
from passlib.context import CryptContext
import os
import math
from dotenv import load_dotenv
import shutil
from pathlib import Path
from enum import Enum
import certifi
import io
import ssl
import asyncio
import smtplib
import secrets
import hashlib
import json
import re
from email.message import EmailMessage
from urllib.parse import quote
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader

load_dotenv()

app = FastAPI(title="PhD Admission Scrutinization System")

# Security
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-09876543210")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
APP_ENV = os.getenv("APP_ENV", "development").strip().lower()
GOOGLE_CLIENT_IDS = [client_id.strip() for client_id in os.getenv("GOOGLE_CLIENT_ID", "").split(",") if client_id.strip()]
PASSWORD_RESET_EXPIRE_MINUTES = int(os.getenv("PASSWORD_RESET_EXPIRE_MINUTES", "30"))
PASSWORD_RESET_RETURN_TOKEN = os.getenv(
    "PASSWORD_RESET_RETURN_TOKEN",
    "true" if APP_ENV in {"development", "dev", "local"} else "false",
).strip().lower() == "true"
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173").rstrip("/")
SMTP_HOST = os.getenv("SMTP_HOST", "").strip()
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "").strip()
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_EMAIL = (os.getenv("SMTP_FROM_EMAIL", "").strip() or SMTP_USERNAME)
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "PTU PhD Admissions").strip()
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "true").strip().lower() == "true"
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "false").strip().lower() == "true"

pwd_context = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174", "http://localhost:5175", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Type"],
)

# MongoDB connection - Python 3.13 compatible configuration
MONGODB_URL = os.getenv("MONGODB_URL")
DATABASE_NAME = os.getenv("DATABASE_NAME", "demo")
ALLOW_MOCK_FALLBACK = os.getenv("ALLOW_MOCK_FALLBACK", "false").strip().lower() == "true"

# Initialize MongoDB client with simplified SSL configuration
USE_MOCK_DB = False
client = AsyncIOMotorClient(
    MONGODB_URL,
    serverSelectionTimeoutMS=5000
)
db = client[DATABASE_NAME]

# Collections (will be reassigned if mock database is used)
users_collection = None
applications_collection = None
reviews_collection = None
notifications_collection = None

# GridFS bucket for storing uploaded documents (PDFs, images, etc.)
fs_bucket = None

# Upload directory
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Export directory for director scholar folders
EXPORTS_DIR = Path("exports")
EXPORTS_DIR.mkdir(exist_ok=True)

# Enums
class UserRole(str, Enum):
    SCHOLAR = "scholar"
    FACULTY = "faculty"
    ADMIN = "admin"
    DIRECTOR = "director"
    DEAN = "dean"

class ApplicationStatus(str, Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_SCRUTINY = "under_scrutiny"
    FACULTY_REVIEW = "faculty_review"
    RECOMMENDED_FOR_INTERVIEW = "recommended_for_interview"
    INTERVIEW_SCHEDULED = "interview_scheduled"
    INTERVIEW_COMPLETED = "interview_completed"
    DEAN_REVIEW = "dean_review"
    DEAN_APPROVED = "dean_approved"
    FINAL_APPROVED = "final_approved"
    ACCEPTED = "accepted"
    ADMISSION_CONFIRMED = "admission_confirmed"
    UNDER_VERIFICATION = "under_verification"
    REVIEWED = "reviewed"
    SHORTLISTED = "shortlisted"
    APPROVED = "approved"
    REJECTED = "rejected"
    WAITLIST = "waitlist"

class ReviewDecision(str, Enum):
    RECOMMEND_FOR_INTERVIEW = "recommend_for_interview"
    APPROVE = "approve"
    REJECT = "reject"
    WAITLIST = "waitlist"

# Pydantic Models
class UserBase(BaseModel):
    email: str
    full_name: str
    role: str  # Changed from UserRole to str to allow dean_1, dean_2, etc.
    department: Optional[str] = None
    phone: Optional[str] = None

class UserCreate(UserBase):
    password: str

class UserInDB(UserBase):
    id: str
    hashed_password: str
    created_at: datetime
    is_active: bool = True

class UserResponse(UserBase):
    id: str
    created_at: datetime
    is_active: bool

class Token(BaseModel):
    access_token: str
    token_type: str
    user: UserResponse

class GoogleLoginRequest(BaseModel):
    credential: str

class ForgotPasswordRequest(BaseModel):
    email: str

class ForgotPasswordResponse(BaseModel):
    message: str
    reset_token: Optional[str] = None
    reset_link: Optional[str] = None
    expires_in_minutes: Optional[int] = None

class ResetPasswordRequest(BaseModel):
    email: str
    token: str
    new_password: str = Field(..., min_length=6)

class PasswordResetResponse(BaseModel):
    message: str

class PersonalDetails(BaseModel):
    full_name: str
    date_of_birth: str
    gender: str
    nationality: str
    institution: Optional[str] = None
    mode_of_study: Optional[str] = None
    candidate_state_type: Optional[str] = None
    category: str
    aadhaar_passport: str
    mobile: str
    email: str
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

class ApplicationCreate(BaseModel):
    personal_details: PersonalDetails
    ug_details: AcademicUG
    pg_details: Optional[AcademicPG] = None
    entrance_exam: EntranceExam
    research_info: ResearchInfo
    work_experience: Optional[WorkExperience] = None
    uploaded_files: Optional[Dict[str, str]] = {}
    paymentStatus: str = "Pending"
    paymentDate: Optional[str] = None
    paymentAmount: Optional[float] = None
    paymentMethod: Optional[str] = None
    transactionId: Optional[str] = None

class EntranceApplicationSubmit(BaseModel):
    application_id: str
    exam_centre: Optional[str] = None
    preferred_language: Optional[str] = None
    confirm_participation: bool = False
    mobile_number: Optional[str] = None
    alternate_contact_number: Optional[str] = None
    gender: Optional[str] = None
    category: Optional[str] = None
    photo_file_id: Optional[str] = None
    signature_file_id: Optional[str] = None
    declaration: bool = False
    apply_vish: Optional[bool] = False

class ReviewCreate(BaseModel):
    application_id: str
    remarks: str
    decision: ReviewDecision
    academic_score: Optional[int] = Field(None, ge=0, le=100)
    research_score: Optional[int] = Field(None, ge=0, le=100)

class InterviewScheduleRequest(BaseModel):
    application_id: str
    interviewDate: str
    interviewMode: str
    interviewPanel: str
    remarks: Optional[str] = None

class InterviewResultRequest(BaseModel):
    application_id: str
    result: str
    remarks: Optional[str] = None

class DeanDecisionRequest(BaseModel):
    decision: str
    remarks: Optional[str] = None

class DirectorDecisionRequest(BaseModel):
    decision: str
    remarks: Optional[str] = None

class AdmissionDecisionRequest(BaseModel):
    decision: str

class FinalFeePaymentRequest(BaseModel):
    payment_method: Optional[str] = None
    transaction_id: Optional[str] = None

class ExamScheduleUpdateRequest(BaseModel):
    examDate: str
    examTime: str
    examCentre: Optional[str] = None

class ExamStatusUpdateRequest(BaseModel):
    application_id: str
    status: str
    remarks: Optional[str] = None

class EntranceEvaluationRequest(BaseModel):
    application_id: str
    attendance_status: str
    entrance_marks: Optional[float] = None
    correctAnswers: Optional[int] = None
    wrongAnswers: Optional[int] = None
    remarks: Optional[str] = None

class InterviewEvaluationRequest(BaseModel):
    application_id: str
    interview_marks: float = Field(..., ge=0, le=50)
    remarks: Optional[str] = None

class SeatDistributionConfig(BaseModel):
    visvesvaraya: int = Field(0, ge=0)
    merit: int = Field(..., ge=0)
    general: int = Field(..., ge=0)
    obc: int = Field(..., ge=0)
    mbc: int = Field(..., ge=0)
    sc_st: int = Field(..., ge=0)

class SeatConfigRequest(BaseModel):
    totalSeats: int = Field(..., ge=1)
    distribution: SeatDistributionConfig

class SeatAllocationRunRequest(BaseModel):
    seatConfig: Optional[SeatConfigRequest] = None
    department: Optional[str] = None
    institute: Optional[str] = None

ACTIVE_APPLICATION_STATUSES = [
    ApplicationStatus.SUBMITTED.value,
    ApplicationStatus.UNDER_SCRUTINY.value,
    ApplicationStatus.FACULTY_REVIEW.value,
    ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value,
    ApplicationStatus.INTERVIEW_SCHEDULED.value,
    ApplicationStatus.INTERVIEW_COMPLETED.value,
    ApplicationStatus.DEAN_REVIEW.value,
    ApplicationStatus.DEAN_APPROVED.value,
    ApplicationStatus.FINAL_APPROVED.value,
    ApplicationStatus.ACCEPTED.value,
    ApplicationStatus.ADMISSION_CONFIRMED.value,
    ApplicationStatus.UNDER_VERIFICATION.value,
    ApplicationStatus.REVIEWED.value,
    ApplicationStatus.SHORTLISTED.value,
]

FACULTY_VISIBLE_STATUSES = [
    ApplicationStatus.FACULTY_REVIEW.value,
    ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value,
    ApplicationStatus.INTERVIEW_SCHEDULED.value,
]

DEAN_VISIBLE_STATUSES = [
    ApplicationStatus.INTERVIEW_COMPLETED.value,
]

DIRECTOR_VISIBLE_STATUSES = [
    ApplicationStatus.DEAN_APPROVED.value,
    ApplicationStatus.FINAL_APPROVED.value,
    ApplicationStatus.REJECTED.value,
    ApplicationStatus.SHORTLISTED.value,
    ApplicationStatus.APPROVED.value,
]

SCRUTINY_ACTIONABLE_STATUSES = [
    ApplicationStatus.SUBMITTED.value,
    ApplicationStatus.UNDER_SCRUTINY.value,
]

FACULTY_ACTIONABLE_STATUSES = [
    ApplicationStatus.FACULTY_REVIEW.value,
]

INTERVIEW_SCHEDULABLE_STATUSES = [
    ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value,
]

INTERVIEW_RESULT_STATUSES = [
    ApplicationStatus.INTERVIEW_SCHEDULED.value,
]

DEAN_ACTIONABLE_STATUSES = [
    ApplicationStatus.INTERVIEW_COMPLETED.value,
]

DIRECTOR_ACTIONABLE_STATUSES = [
    ApplicationStatus.DEAN_APPROVED.value,
]

PTU_ENTRANCE_TOTAL_QUESTIONS = 100
PTU_ENTRANCE_TOTAL_MARKS = 150
PTU_ENTRANCE_DURATION_HOURS = 3
PTU_ENTRANCE_QUALIFY_MARKS = 75
PTU_ENTRANCE_GENERAL_MIN_MARKS = 75
PTU_ENTRANCE_RESERVED_MIN_MARKS = 68
PTU_ENTRANCE_RESERVED_CATEGORIES = {"sc", "st", "obc", "ebc", "pwd", "women"}
PTU_ENTRANCE_SUBJECT_QUESTIONS = 50
PTU_ENTRANCE_SUBJECT_MARKS_PER_QUESTION = 2
PTU_ENTRANCE_SUBJECT_TOTAL_MARKS = PTU_ENTRANCE_SUBJECT_QUESTIONS * PTU_ENTRANCE_SUBJECT_MARKS_PER_QUESTION
PTU_ENTRANCE_ANALYTICAL_QUESTIONS = 50
PTU_ENTRANCE_ANALYTICAL_MARKS_PER_QUESTION = 1
PTU_ENTRANCE_ANALYTICAL_TOTAL_MARKS = PTU_ENTRANCE_ANALYTICAL_QUESTIONS * PTU_ENTRANCE_ANALYTICAL_MARKS_PER_QUESTION
PTU_INTERVIEW_TOTAL_MARKS = 50
PTU_FINAL_WEIGHT_PG = 0.2
PTU_FINAL_WEIGHT_ENTRANCE = 0.3
PTU_FINAL_WEIGHT_INTERVIEW = 0.5
OFFER_LETTER_DEADLINE_DAYS = int(os.getenv("OFFER_LETTER_DEADLINE_DAYS", "15"))
PTU_REGISTRATION_YEAR = os.getenv("PTU_REGISTRATION_YEAR", "26").strip() or "26"
PTU_PROGRAM_CODE = os.getenv("PTU_PROGRAM_CODE", "017").strip() or "017"
PTU_DEPARTMENT_CODES = {
    "CE": "06",
    "CSE": "07",
    "EEE": "08",
    "ECE": "09",
    "EIE": "10",
    "HSS": "11",
    "IT": "12",
    "ME": "15",
    "CS": "73",
    "MATHS": "14",
}
RECOMMENDED_FOR_INTERVIEW_LABEL = "Recommended for Interview"
INTERVIEW_SCHEDULED_LABEL = "Interview Scheduled"
INTERVIEW_COMPLETED_LABEL = "Interview Completed"
RANKED_CANDIDATE_LABEL = "Ranked"
SEAT_ALLOCATED_LABEL = "Seat Allocated"
NOT_SELECTED_LABEL = "Not Selected"
DEPARTMENT_SEAT_CONFIGS = {
    "CSE": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "ECE": {
        "TOTAL": 11,
        "MERIT": 4,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "IT": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "CE": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "EEE": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "EIE": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "CS": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "ME": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "MATHS": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
    "HSS": {
        "TOTAL": 10,
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
    },
}

DEFAULT_SEAT_CONFIG = DEPARTMENT_SEAT_CONFIGS["IT"]

SEAT_CONFIG_DEPARTMENT_ALIASES = {
    "CIVIL": "CE",
    "CIVIL ENGINEERING": "CE",
    "COMPUTER SCIENCE": "CSE",
    "COMPUTER SCIENCE AND ENGINEERING": "CSE",
    "CSE": "CSE",
    "ECE": "ECE",
    "ELECTRONICS AND COMMUNICATION": "ECE",
    "ELECTRONICS AND COMMUNICATION ENGINEERING": "ECE",
    "ELECTRICAL AND ELECTRONICS ENGINEERING": "EEE",
    "ELECTRICAL ELECTRONICS ENGINEERING": "EEE",
    "EEE": "EEE",
    "EIE": "EIE",
    "INFORMATION TECHNOLOGY": "IT",
    "IT": "IT",
    "MECHANICAL": "ME",
    "MECHANICAL ENGINEERING": "ME",
    "ME": "ME",
    "MATHEMATICS": "MATHS",
    "MATHS": "MATHS",
    "HUMANITIES AND SOCIAL SCIENCES": "HSS",
    "HSS": "HSS",
}

def normalize_department_for_seat_config(department: Optional[str]) -> str:
    normalized = re.sub(r"[^A-Z0-9]+", " ", str(department or "").strip().upper()).strip()
    return SEAT_CONFIG_DEPARTMENT_ALIASES.get(normalized, normalized)

def validate_fixed_seat_config(config_key: str, config: Dict[str, Any]) -> Dict[str, Any]:
    total = int(config.get("TOTAL") or 0)
    merit = int(config.get("MERIT") or 0)
    general = int(config.get("GENERAL") or 0)
    obc = int(config.get("OBC") or 0)
    mbc = int(config.get("MBC") or 0)
    sc_st = int(config.get("SC_ST") or 0)
    calculated_total = merit + general + obc + mbc + sc_st

    if total <= 0:
        raise ValueError(f"Seat config for {config_key} must define a positive TOTAL")
    if total != calculated_total:
        raise ValueError(
            f"Seat config mismatch for {config_key}: TOTAL={total}, distribution total={calculated_total}"
        )

    return {
        "TOTAL": total,
        "MERIT": merit,
        "GENERAL": general,
        "OBC": obc,
        "MBC": mbc,
        "SC_ST": sc_st,
    }

VALIDATED_SEAT_CONFIGS = {
    config_key: validate_fixed_seat_config(config_key, config)
    for config_key, config in DEPARTMENT_SEAT_CONFIGS.items()
}

def get_department_seat_config(department: str) -> Dict[str, Any]:
    config_key = normalize_department_for_seat_config(department)
    config = VALIDATED_SEAT_CONFIGS.get(config_key)
    if not config:
        raise HTTPException(status_code=400, detail=f"Seat config not defined for department: {department}")
    return config

def to_allocation_seat_config(config: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "totalSeats": config["TOTAL"],
        "distribution": {
            "visvesvaraya": int(config.get("VISVESVARAYA") or 0),
            "merit": config["MERIT"],
            "general": config["GENERAL"],
            "obc": config["OBC"],
            "mbc": config["MBC"],
            "sc_st": config["SC_ST"],
        },
    }
DEFAULT_APPLICATION_FEE = float(os.getenv("APPLICATION_FEE", "2000"))
DEFAULT_EXAM_DATE = os.getenv("ENTRANCE_EXAM_DATE", "2025-06-20")
DEFAULT_EXAM_TIME = os.getenv("ENTRANCE_EXAM_TIME", "10:00 AM - 1:00 PM")
DEFAULT_EXAM_DURATION = "3 Hours"
DEFAULT_REPORTING_TIME = "09:30 AM"
DEFAULT_EXAM_CENTRE = "Puducherry Technological University"

# ============================================
# VISVESVARAYA PHD SCHEME (PHASE-II) CONFIG
# ============================================
VISVESVARAYA_SCHEME_CONFIG = {
    "enabled": True,
    "seats": 1,  # Configurable number of Visvesvaraya seats
    "department_seats": {
        "Computer Science": 1,
        "Information Technology": 0,
        "Electronics and Communication Engineering": 0,
        "Electrical and Instrumentation Engineering": 0,
        "Mechanical Engineering": 0,
        "Mechatronics": 0,
        "Civil Engineering": 0,
        "Chemical Engineering": 0
    },
    "required_status": "admission_confirmed",
}

VISVESVARAYA_FELLOWSHIP_SUPPORT = {
    "fellowship_type": "Visvesvaraya",
    "stipend_year_1_2": 38750,  # ₹38,750/month for Year 1-2
    "stipend_year_3_5": 43750,  # ₹43,750/month for Year 3-5
    "research_grant": 120000,   # ₹1,20,000/year
    "rent_support": "As per govt norms",
    "international_conference_support": "From 3rd year onwards",
    "lab_visit_abroad_support": "6 months support",
    "max_duration_years": 5,  # Up to 5 years
}

VISVESVARAYA_SCHEME_RULES = {
    "only_new_phd": True,
    "no_other_govt_fellowship": True,
    "maintain_academic_progress": True,
    "use_seat_same_academic_year": True,
    "no_replacement_after_allocation": True,
    "termination_on_poor_progress": True,
    "termination_on_fund_misuse": True,
    "annual_performance_monitoring": True,
}

SCRUTINY_CONCESSION_CATEGORIES = {"sc", "st", "obc", "ebc", "pwd", "women"}
SCRUTINY_MIN_CGPA_BY_CATEGORY = {
    "sc": 7.5,
    "bc": 7.0,
    "mbc": 7.0,
    "obc": 7.5,
    "general": 7.5,
}
SCRUTINY_MIN_PERCENTAGE_BY_CATEGORY = {
    "sc": 50,
    "bc": 50,
    "mbc": 50,
    "obc": 50,
    "general": 55,
}
SCRUTINY_REQUIRED_BASE_DOCUMENTS = [
    "dob_proof",
    "hsc_marksheet",
    "ug_degree_certificate",
    "pg_degree_certificate",
    "pg_marksheets",
    "transfer_certificate",
    "conduct_certificate",
    "research_proposal",
]

def derive_hall_ticket_number(application_doc: dict) -> str:
    registration_id = str(application_doc.get("registration_id") or application_doc.get("_id") or "N/A")
    cleaned_id = re.sub(r"[^A-Za-z0-9]", "", registration_id).upper()
    cleaned_id = cleaned_id or "000000"
    return f"PTU-ENT-{cleaned_id[-12:]}"

def calculate_reporting_time(exam_time: str) -> str:
    for time_format in ("%I:%M %p", "%H:%M"):
        try:
            parsed_time = datetime.strptime(exam_time, time_format)
            reporting_time = parsed_time - timedelta(minutes=30)
            return reporting_time.strftime("%I:%M %p")
        except ValueError:
            continue
    return DEFAULT_REPORTING_TIME

def resolve_exam_value(value: Any, default_value: str) -> str:
    text = str(value or "").strip()
    if not text or text.lower() in {"to be announced", "tba", "tbd", "pending", "n/a", "na"}:
        return default_value
    return text

def get_effective_exam_schedule(application_doc: dict) -> dict:
    exam_date = resolve_exam_value(application_doc.get("entranceExamDate"), DEFAULT_EXAM_DATE)
    exam_time = resolve_exam_value(application_doc.get("entranceExamTime"), DEFAULT_EXAM_TIME)
    exam_duration = resolve_exam_value(application_doc.get("entranceExamDuration"), DEFAULT_EXAM_DURATION)
    reporting_time = resolve_exam_value(application_doc.get("entranceExamReportingTime"), calculate_reporting_time(exam_time))
    exam_centre = resolve_exam_value(application_doc.get("entranceExamCentre"), DEFAULT_EXAM_CENTRE)
    return {
        "examDate": exam_date,
        "examTime": exam_time,
        "examDuration": exam_duration,
        "reportingTime": reporting_time,
        "examCentre": exam_centre,
    }

def get_ptu_entrance_exam_policy() -> dict:
    return {
        "selectionProcess": ["entrance_test", "interview"],
        "entranceTest": {
            "questionPaperCountPerDiscipline": 1,
            "questionType": "MCQ",
            "totalQuestions": PTU_ENTRANCE_TOTAL_QUESTIONS,
            "totalMarks": PTU_ENTRANCE_TOTAL_MARKS,
            "durationHours": PTU_ENTRANCE_DURATION_HOURS,
            "sections": [
                {
                    "name": "Subject/Discipline Specific",
                    "weightagePercent": 50,
                    "questions": PTU_ENTRANCE_SUBJECT_QUESTIONS,
                    "marksPerQuestion": PTU_ENTRANCE_SUBJECT_MARKS_PER_QUESTION,
                    "totalMarks": PTU_ENTRANCE_SUBJECT_TOTAL_MARKS,
                    "standard": "National-level eligibility test standard",
                },
                {
                    "name": "Proficiency in English & Analytical Skills",
                    "weightagePercent": 50,
                    "questions": PTU_ENTRANCE_ANALYTICAL_QUESTIONS,
                    "marksPerQuestion": PTU_ENTRANCE_ANALYTICAL_MARKS_PER_QUESTION,
                    "totalMarks": PTU_ENTRANCE_ANALYTICAL_TOTAL_MARKS,
                },
            ],
            "qualifyingMarks": PTU_ENTRANCE_QUALIFY_MARKS,
            "eligibilityReference": "Table 1.0",
        },
        "examDate": DEFAULT_EXAM_DATE,
        "examTime": DEFAULT_EXAM_TIME,
        "reportingTime": DEFAULT_REPORTING_TIME,
        "examDuration": DEFAULT_EXAM_DURATION,
        "examCentre": DEFAULT_EXAM_CENTRE,
    }

# Helper function to serialize MongoDB/Python values into JSON-safe values
def serialize_document(value):
    """Recursively convert values (including ObjectId and datetime) to JSON-safe types."""
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, list):
        return [serialize_document(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_document(item) for key, item in value.items()}
    return value

def sanitize_path_component(value: str) -> str:
    text = (value or "").strip()
    if not text:
        return "unknown"

    cleaned = re.sub(r"[^A-Za-z0-9._-]+", "_", text)
    cleaned = cleaned.strip("._")
    return cleaned or "unknown"

def extract_stored_file_id(value: Any) -> str:
    if isinstance(value, str):
        return value.strip()

    if isinstance(value, dict):
        return str(
            value.get("file_id")
            or value.get("id")
            or value.get("filename")
            or ""
        ).strip()

    return ""

def calculate_review_overall_score(academic_score: Optional[int], research_score: Optional[int]) -> Optional[float]:
    scores = [score for score in [academic_score, research_score] if score is not None]
    if not scores:
        return None
    return round(sum(scores) / len(scores), 2)

def get_application_status_from_scrutiny(scrutiny_status: str) -> str:
    if scrutiny_status in {"verified", "approved"}:
        return ApplicationStatus.FACULTY_REVIEW.value
    if scrutiny_status == "rejected":
        return ApplicationStatus.REJECTED.value
    return ApplicationStatus.UNDER_SCRUTINY.value

def get_application_status_from_faculty_decision(decision: str) -> str:
    if decision in {
        ReviewDecision.RECOMMEND_FOR_INTERVIEW.value,
        ReviewDecision.APPROVE.value,
        ReviewDecision.WAITLIST.value,
    }:
        return ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value
    return ApplicationStatus.REJECTED.value

def count_embedded_reviews(reviews: Optional[List[dict]]) -> int:
    return len(reviews or [])

def is_payment_completed(application_doc: dict) -> bool:
    return (application_doc or {}).get("paymentStatus") == "Paid"

def get_default_final_fee_amount(application_doc: dict) -> float:
    personal = (application_doc or {}).get("personal_details") or {}
    state_type = str(
        personal.get("candidate_state_type")
        or (application_doc or {}).get("candidate_state_type")
        or ""
    ).strip().lower()
    return 56160.0 if state_type == "puducherry ut" else 100000.0

def is_final_fee_paid(application_doc: dict) -> bool:
    return str((application_doc or {}).get("finalFeeStatus") or "").strip().lower() == "paid"

def is_exam_qualified(application_doc: dict) -> bool:
    doc = application_doc or {}
    if doc.get("qualified") is True:
        return True
    return doc.get("examStatus") == "Qualified"

def is_entrance_application_submitted(application_doc: dict) -> bool:
    return bool((application_doc or {}).get("entranceFormSubmitted")) and (
        (application_doc or {}).get("entranceApplicationStatus") == "Submitted"
    )

def is_scrutiny_approved(application_doc: dict) -> bool:
    scrutiny_info = (application_doc or {}).get("scrutiny") or {}
    scrutiny_status = str(
        (application_doc or {}).get("scrutinyStatus")
        or (application_doc or {}).get("scrutiny_status")
        or scrutiny_info.get("status")
        or ""
    ).strip().lower()
    return scrutiny_status in {"approved", "verified"}

def can_proceed_in_workflow(application_doc: dict) -> bool:
    return is_payment_completed(application_doc) and is_exam_qualified(application_doc)

def enforce_paid_and_qualified(application_doc: dict) -> None:
    if not is_payment_completed(application_doc):
        raise HTTPException(status_code=400, detail="Application fee payment is pending")
    if not is_exam_qualified(application_doc):
        raise HTTPException(status_code=400, detail="Entrance exam status is not qualified")

def enforce_hall_ticket_eligibility(application_doc: dict) -> None:
    if not is_entrance_application_submitted(application_doc):
        raise HTTPException(status_code=400, detail="Entrance application has not been submitted")
    if not is_scrutiny_approved(application_doc):
        raise HTTPException(status_code=400, detail="Scrutiny is not approved")

def is_reserved_category_for_entrance(category: Any) -> bool:
    normalized = str(category or "").strip().lower()
    return normalized in PTU_ENTRANCE_RESERVED_CATEGORIES

def is_qualified_in_entrance(category: Any, marks: float) -> bool:
    required = PTU_ENTRANCE_RESERVED_MIN_MARKS if is_reserved_category_for_entrance(category) else PTU_ENTRANCE_GENERAL_MIN_MARKS
    return marks >= required

def get_application_department(application_doc: dict) -> str:
    app_department = (application_doc.get("department") or "").strip()
    fallback_department = ((application_doc.get("ug_details") or {}).get("branch_department") or "").strip()
    return app_department or fallback_department

def get_application_institute(application_doc: dict) -> str:
    institute = str(application_doc.get("institute") or "").strip()
    if institute:
        return institute

    institute_name = str(application_doc.get("instituteName") or "").strip()
    if institute_name:
        return institute_name

    personal_institute = str(((application_doc.get("personal_details") or {}).get("institution")) or "").strip()
    if personal_institute:
        return personal_institute

    personal_institute = str(((application_doc.get("personal_details") or {}).get("institute_name")) or "").strip()
    if personal_institute:
        return personal_institute

    ug_institute = str(((application_doc.get("ug_details") or {}).get("college_university")) or "").strip()
    if ug_institute:
        return ug_institute

    return "PTU"

def normalize_category_for_allocation(category: Any) -> str:
    normalized = str(category or "").strip().lower().replace("-", "_")
    alias_map = {
        "general": "general",
        "gen": "general",
        "open": "general",
        "obc": "obc",
        "mbc": "mbc",
        "sc": "sc",
        "st": "st",
    }
    return alias_map.get(normalized, normalized)

def validate_and_normalize_seat_config(config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    effective = config or DEFAULT_SEAT_CONFIG
    total_seats = int(effective.get("totalSeats") or 0)
    distribution = effective.get("distribution") or {}

    required_categories = ["merit", "general", "obc", "mbc", "sc_st"]
    normalized_distribution: Dict[str, int] = {}
    for category in required_categories:
        if category not in distribution:
            raise HTTPException(status_code=400, detail=f"Missing seat distribution category: {category}")
        value = int(distribution.get(category))
        if value < 0:
            raise HTTPException(status_code=400, detail=f"Seat count for {category} cannot be negative")
        normalized_distribution[category] = value

    visvesvaraya_value = int(distribution.get("visvesvaraya") or 0)
    if visvesvaraya_value < 0:
        raise HTTPException(status_code=400, detail="Seat count for visvesvaraya cannot be negative")
    normalized_distribution["visvesvaraya"] = visvesvaraya_value

    distribution_total = sum(normalized_distribution.values())
    if total_seats <= 0:
        raise HTTPException(status_code=400, detail="Total seats must be greater than zero")
    if total_seats != distribution_total:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid seat configuration: totalSeats={total_seats}, distribution total={distribution_total}",
        )

    return {
        "totalSeats": total_seats,
        "distribution": normalized_distribution,
    }

async def recalculate_department_entrance_ranks(department: str) -> None:
    normalized_department = (department or "").strip()
    if not normalized_department:
        return

    # 1. Fetch all applications in this department with marks to calculate dynamic threshold
    dept_apps = []
    cursor = applications_collection.find({
        "entranceMarks": {"$ne": None},
        "attendanceStatus": "Present"
    })
    async for doc in cursor:
        doc_department = get_application_department(doc)
        if departments_match(normalized_department, doc_department):
            dept_apps.append(doc)

    if not dept_apps:
        return

    # 2. Calculate dynamic threshold: Threshold = Max - Min
    marks_list = [float(app.get("entranceMarks") or 0) for app in dept_apps]
    score_max = max(marks_list)
    score_min = min(marks_list)
    score_threshold = round(score_max - score_min, 4)

    # 3. Update 'qualified' status for all candidates based on the dynamic threshold
    qualified_docs = []
    for app in dept_apps:
        marks = float(app.get("entranceMarks") or 0)
        is_qualified = marks >= score_threshold
        
        current_status = app.get("candidateStatus")
        new_candidate_status = "Qualified for Ranking" if is_qualified else "Rejected"
        if is_qualified and current_status in [RECOMMENDED_FOR_INTERVIEW_LABEL, INTERVIEW_SCHEDULED_LABEL, INTERVIEW_COMPLETED_LABEL, RANKED_CANDIDATE_LABEL]:
            new_candidate_status = current_status

        await applications_collection.update_one(
            {"_id": app["_id"]},
            {"$set": {
                "qualified": is_qualified,
                "candidateStatus": new_candidate_status,
                "updated_at": datetime.utcnow()
            }}
        )
        
        if is_qualified:
            # Refresh doc content for sorting
            app["qualified"] = True
            qualified_docs.append(app)

    # 4. Perform ranking among qualified candidates
    qualified_docs.sort(
        key=lambda doc: (
            -float(doc.get("entranceMarks") or 0),
            str(doc.get("created_at") or ""),
            str(doc.get("_id") or ""),
        )
    )

    for index, doc in enumerate(qualified_docs):
        rank_value = index + 1
        await applications_collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"entranceRank": rank_value, "updated_at": datetime.utcnow()}}
        )

    # 5. Clear entranceRank for those no longer qualified in this department
    reset_cursor = applications_collection.find({
        "qualified": {"$ne": True},
        "entranceRank": {"$ne": None}
    })
    async for doc in reset_cursor:
        doc_department = get_application_department(doc)
        if departments_match(normalized_department, doc_department):
            await applications_collection.update_one(
                {"_id": doc["_id"]},
                {"$set": {"entranceRank": None, "updated_at": datetime.utcnow()}}
            )


def normalize_category_for_scrutiny(category: Any) -> str:
    return str(category or "").strip().lower()

def extract_numeric_marks(value: Any) -> Optional[float]:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    match = re.search(r"\d+(\.\d+)?", text)
    if not match:
        return None
    try:
        return float(match.group(0))
    except ValueError:
        return None

def is_recommended_for_interview_candidate(candidate_status: Any) -> bool:
    normalized = str(candidate_status or "").strip().lower()
    return normalized in {"recommended for interview", "recommended_for_interview"}

def is_interview_completed_candidate(candidate_status: Any) -> bool:
    normalized = str(candidate_status or "").strip().lower()
    return normalized in {"interview completed", "interview_completed"}

def is_ranked_candidate(candidate_status: Any) -> bool:
    normalized = str(candidate_status or "").strip().lower()
    return normalized in {"ranked", "qualified for ranking"}

def extract_pg_marks_for_final_score(application_doc: dict) -> Optional[float]:
    explicit_pg_marks = extract_numeric_marks(application_doc.get("pgMarks"))
    if explicit_pg_marks is not None:
        return explicit_pg_marks
    return extract_numeric_marks(((application_doc.get("pg_details") or {}).get("cgpa_percentage")))

def calculate_final_score_ptu(pg_marks: float, entrance_marks: float, interview_marks: float) -> float:
    entrance_percent = (float(entrance_marks) / PTU_ENTRANCE_TOTAL_MARKS) * 100
    interview_percent = (float(interview_marks) / PTU_INTERVIEW_TOTAL_MARKS) * 100
    final_score = (
        float(pg_marks) * PTU_FINAL_WEIGHT_PG
        + entrance_percent * PTU_FINAL_WEIGHT_ENTRANCE
        + interview_percent * PTU_FINAL_WEIGHT_INTERVIEW
    )
    return round(final_score, 2)

async def recalculate_department_final_ranks(department: str) -> None:
    normalized_department = (department or "").strip()
    if not normalized_department:
        return

    eligible_docs: List[dict] = []
    cursor = applications_collection.find({"interviewMarks": {"$ne": None}})
    async for doc in cursor:
        doc_department = get_application_department(doc)
        if not departments_match(normalized_department, doc_department):
            continue

        candidate_status = doc.get("candidateStatus")
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

    for index, doc in enumerate(eligible_docs):
        await applications_collection.update_one(
            {"_id": doc["_id"]},
            {
                "$set": {
                    "finalRank": index + 1,
                    "candidateStatus": RANKED_CANDIDATE_LABEL,
                    "updated_at": datetime.utcnow(),
                }
            }
        )

    # Clear stale final rank where final score is missing in this department.
    reset_cursor = applications_collection.find({"finalRank": {"$ne": None}})
    async for doc in reset_cursor:
        doc_department = get_application_department(doc)
        if not departments_match(normalized_department, doc_department):
            continue
        if doc.get("finalScore") is not None:
            continue

        await applications_collection.update_one(
            {"_id": doc["_id"]},
            {"$set": {"finalRank": None, "updated_at": datetime.utcnow()}}
        )

# ============================================
# VISVESVARAYA SCHEME HELPER FUNCTIONS
# ============================================

def is_eligible_for_visvesvaraya(candidate_doc: dict, department: str) -> bool:
    """
    Check if candidate is eligible for Visvesvaraya PhD Scheme allocation.
    
    Eligibility Criteria:
    1. Department matches configured eligible departments
    2. admission_status == "Accepted"
    3. is_new_phd is True (fresh PhD, not transfer/extension)
    4. has_other_fellowship is False (no other govt fellowship)
    
    FALLBACK LOGIC: If Visvesvaraya seats not filled by eligible candidates,
    unused seats automatically fall back to MERIT pool (no manual intervention needed).
    """
    if not VISVESVARAYA_SCHEME_CONFIG.get("enabled"):
        return False

    # --- NULL-SAFE FIELD READS ---
    doc_department = (candidate_doc.get("department") or "").strip()
    status = (candidate_doc.get("status") or "").strip()
    is_new_phd = candidate_doc.get("is_new_phd")  # Expect explicit True/False
    has_other_fellowship = candidate_doc.get("has_other_fellowship")  # Expect explicit True/False
    apply_vish = candidate_doc.get("apply_vish")  # Expect explicit True/False

    # DEBUG: log each check so failures are visible in server logs
    print(
        f"[VISVESVARAYA CHECK] dept={doc_department!r}, "
        f"apply_vish={apply_vish!r}, "
        f"status={status!r}, "
        f"is_new_phd={is_new_phd!r}, "
        f"has_other_fellowship={has_other_fellowship!r}"
    )

    # 1. Department eligibility (Strict string matching and seat config)
    department_seats = VISVESVARAYA_SCHEME_CONFIG.get("department_seats", {})
    if doc_department not in department_seats or department_seats.get(doc_department, 0) <= 0:
        print(f"[VISVESVARAYA] SKIP - department {doc_department!r} not eligible or has 0 seats")
        return False

    # 1.5. Must have explicitly applied for Visvesvaraya Scheme
    if str(apply_vish).strip().lower() != "true":
        print("[VISVESVARAYA] SKIP - did not apply for Visvesvaraya Scheme")
        return False

    # 2. Admission status must be "admission_confirmed" (null-safe)
    if status.lower() != "admission_confirmed":
        print(f"[VISVESVARAYA] SKIP - status {status!r} not admission_confirmed")
        return False

    # 3. Must be new PhD (default True for backward compatibility)
    if str(is_new_phd).strip().lower() == "false":
        print("[VISVESVARAYA] SKIP - not a new PhD candidate")
        return False

    # 4. Must not hold another government fellowship (default False for backward compatibility)
    if str(has_other_fellowship).strip().lower() == "true":
        print("[VISVESVARAYA] SKIP - has other fellowship")
        return False

    return True


def assign_visvesvaraya_fellowship(candidate_doc: dict) -> dict:
    """
    Assign Visvesvaraya fellowship support details to a candidate.
    Returns a dictionary of fellowship fields to add to the candidate.
    """
    fellowship_data = {
        "seat_type": "VISVESVARAYA",
        "fellowship_type": VISVESVARAYA_FELLOWSHIP_SUPPORT["fellowship_type"],
        "stipend_year1_2": VISVESVARAYA_FELLOWSHIP_SUPPORT["stipend_year_1_2"],
        "stipend_year3_5": VISVESVARAYA_FELLOWSHIP_SUPPORT["stipend_year_3_5"],
        "research_grant_annual": VISVESVARAYA_FELLOWSHIP_SUPPORT["research_grant"],
        "rent_support": VISVESVARAYA_FELLOWSHIP_SUPPORT["rent_support"],
        "international_conference_support": VISVESVARAYA_FELLOWSHIP_SUPPORT["international_conference_support"],
        "lab_visit_abroad_support": VISVESVARAYA_FELLOWSHIP_SUPPORT["lab_visit_abroad_support"],
        "fellowship_duration_years": VISVESVARAYA_FELLOWSHIP_SUPPORT["max_duration_years"],
        "fellowship_status": "Active",
        "fellowship_allocated_date": datetime.utcnow(),
        "fellowship_scheme_rules": VISVESVARAYA_SCHEME_RULES,
        "visvesvaraya_scheme_phase": "Phase-II",
    }
    return fellowship_data


async def run_seat_allocation(
    seat_config: Dict[str, Any],
    department: Optional[str] = None,
    institute: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Allocate seats based on ranking and Anna University lapse seat concept.
    
    ================================================================================
    ENHANCED ALLOCATION PRIORITY WITH VISVESVARAYA FALLBACK LOGIC
    ================================================================================
    
    STEP 1-3: Setup & Sorting
    - Re-rank candidates DURING allocation (don't rely on old finalRank)
    - Sort ONLY by final_score (strict numeric sorting)
    - Assign new rank AFTER sorting
    
    STEP 4A: VISVESVARAYA SCHEME ALLOCATION (FIRST PRIORITY)
    - Allocate configured Visvesvaraya seats to eligible candidates
    - Eligibility: department match + new PhD + no other fellowship + accepted status
    - Count: visvesvaraya_count <= visvesvaraya_seats
    
    STEP 4B: CRITICAL FALLBACK LOGIC (NO SEAT WASTAGE)
    - Calculate: unused_visvesvaraya_seats = visvesvaraya_seats - visvesvaraya_count
    - If unused_visvesvaraya_seats > 0:
      * effective_merit_seats = merit_seats + unused_visvesvaraya_seats
      * Allocate from expanded MERIT pool (NOT category)
      * Log fallback for transparency
    - This ensures NO seats are wasted while maintaining fairness
    
    STEP 5-6: MERIT & CATEGORY ALLOCATION
    - MERIT: Use effective_merit_seats (includes fallback pool)
    - CATEGORY: Allocate remaining base seats by category quotas
    - Backfill: Fill remaining base seats by rank (open conversion)
    
    STEP 7: LAPSE ALLOCATION
    - Allocate extra 30% seats from ranks beyond base seats
    - Total available: base_seats + lapse_seats
    
    STEP 8-11: Finalization
    - Assign fellowship details for VISVESVARAYA allocations
    - Mark remaining as "Not Selected"
    - Generate allocation summary with fallback info
    
    SEAT BREAKDOWN:
    - Base seats: configurable (default 10)
    - Extra seats (lapse): ceil(base_seats * 0.30) = 3
    - Total seats: 13
    - Total with Visvesvaraya: 14
    
    NON-BREAKING GUARANTEE:
    - Existing MERIT, CATEGORY, LAPSE logic unchanged
    - Database schema untouched
    - Visvesvaraya fallback to MERIT is automatic
    - Backward compatible with non-Visvesvaraya candidates
    
    KEY FEATURES:
    - Priority: Visvesvaraya → Fallback MERIT → Category → Lapse
    - Fairness: Rank-based allocation within each tier
    - Transparency: Fallback details in summary
    - Efficiency: No seat wastage, all seats utilized
    
    CRITICAL FIX:
    - Re-rank candidates DURING allocation (don't rely on old finalRank)
    - Sort ONLY by final_score (strict numeric sorting)
    - Assign rank AFTER sorting
    - Then allocate top N candidates
    """
    normalized_seat_config = validate_and_normalize_seat_config(seat_config)
    category_distribution = normalized_seat_config["distribution"]
    total_seats_limit = int(normalized_seat_config["totalSeats"])
    
    normalized_department = (department or "").strip()
    normalized_institute = (institute or "").strip()

    # STEP 1: Fetch candidates (ignore old finalRank, will re-rank)
    query = {
        "candidateStatus": RANKED_CANDIDATE_LABEL,
        "finalScore": {"$ne": None},  # Changed: use finalScore, not finalRank
    }

    candidate_docs: List[dict] = []
    cursor = applications_collection.find(query)
    async for doc in cursor:
        doc_department = get_application_department(doc)
        doc_institute = get_application_institute(doc)

        if normalized_department and not departments_match(normalized_department, doc_department):
            continue
        if normalized_institute and str(doc_institute or "").strip().lower() != normalized_institute.lower():
            continue

        candidate_docs.append(doc)

    if not candidate_docs:
        raise HTTPException(
            status_code=400,
            detail="No ranked candidates found for seat allocation. Ensure final scores are calculated.",
        )

    grouped_candidates: Dict[tuple[str, str], List[dict]] = {}
    for doc in candidate_docs:
        key = (get_application_department(doc) or "N/A", get_application_institute(doc) or "PTU")
        grouped_candidates.setdefault(key, []).append(doc)

    updated_candidates_count = 0
    total_allocated_candidates = 0
    total_not_selected_candidates = 0
    groups_summary: List[Dict[str, Any]] = []

    for (group_department, group_institute), docs in grouped_candidates.items():
        # Reset previous allocation data
        for c in docs:
            c["seatType"] = None
            c["seatAllocationStatus"] = None
            if not c.get("status"): c["status"] = "admission_confirmed"
            if c.get("is_new_phd") is None: c["is_new_phd"] = True
            if c.get("has_other_fellowship") is None: c["has_other_fellowship"] = False
            if c.get("apply_vish") is None: c["apply_vish"] = False

        # STEP 2: Sort by final score descending
        all_ranked = sorted(docs, key=lambda d: -float(d.get("finalScore") or 0))
        
        # Select top N candidates (selected group)
        selected_candidates = all_ranked[:total_seats_limit]
        
        allocated_ids: set[ObjectId] = set()
        seat_type_by_id: Dict[ObjectId, str] = {}

        # Distribution setup
        department_seats_map = VISVESVARAYA_SCHEME_CONFIG.get("department_seats", {})
        dept_visvesvaraya_seats = department_seats_map.get(group_department, 0)
        
        quotas = {
            "MERIT": int(category_distribution["merit"]),
            "GENERAL": int(category_distribution["general"]),
            "OBC": int(category_distribution["obc"]),
            "MBC": int(category_distribution["mbc"]),
            "SC_ST": int(category_distribution["sc_st"]),
        }

        def is_pu(doc):
            personal = doc.get("personal_details") or {}
            state = str(
                personal.get("candidate_state_type")
                or doc.get("candidate_state_type")
                or ""
            ).strip().lower()
            # Normalize: remove parentheses and extra spaces
            normalized_state = state.replace("(", "").replace(")", "").replace("  ", " ")
            return "puducherry ut" in normalized_state or "puducherry" in normalized_state

        # PASS 1: VISVESVARAYA (First Priority)
        vish_allocated = 0
        for doc in selected_candidates:
            if vish_allocated >= dept_visvesvaraya_seats: break
            # UPDATED: Visvesvaraya seats are also restricted to PU candidates based on user requirement
            if is_pu(doc) and is_eligible_for_visvesvaraya(doc, group_department):
                allocated_ids.add(doc["_id"])
                seat_type_by_id[doc["_id"]] = "VISVESVARAYA"
                vish_allocated += 1

        # PASS 2: MERIT (Open to all including Other State)
        merit_allocated = 0
        for doc in selected_candidates:
            if merit_allocated >= quotas["MERIT"]: break
            if doc["_id"] in allocated_ids: continue
            allocated_ids.add(doc["_id"])
            seat_type_by_id[doc["_id"]] = "MERIT"
            merit_allocated += 1

        # PASS 3: CATEGORY (PU Only - OS scholars even with category are excluded)
        cat_counts = {"GENERAL": 0, "OBC": 0, "MBC": 0, "SC_ST": 0}
        for doc in selected_candidates:
            if doc["_id"] in allocated_ids: continue
            if not is_pu(doc): continue
            
            raw_cat = ((doc.get("personal_details") or {}).get("category")) or doc.get("category")
            norm_cat = normalize_category_for_allocation(raw_cat)
            if norm_cat in {"sc", "st"}: norm_cat = "sc_st"
            norm_cat = norm_cat if norm_cat in {"general", "obc", "mbc", "sc_st"} else "general"
            cat_key = norm_cat.upper()
            
            if cat_counts[cat_key] < quotas[cat_key]:
                allocated_ids.add(doc["_id"])
                seat_type_by_id[doc["_id"]] = cat_key
                cat_counts[cat_key] += 1

        # STEP 4: LAPSE CALCULATION
        unused_seats_count = total_seats_limit - len(allocated_ids)
        max_lapse_allowed = math.floor(total_seats_limit * 0.3)
        
        lapse_seats_to_allocate = min(unused_seats_count, max_lapse_allowed)
        vacancy_count = unused_seats_count - lapse_seats_to_allocate
        
        # PASS 4: LAPSE ALLOCATION (Open to all including Other State within selected group)
        lapse_allocated = 0
        for doc in selected_candidates:
            if lapse_allocated >= lapse_seats_to_allocate: break
            if doc["_id"] in allocated_ids: continue
            allocated_ids.add(doc["_id"])
            seat_type_by_id[doc["_id"]] = "LAPSE"
            lapse_allocated += 1

        # STEP 5: DB UPDATES & SUMMARY
        group_allocated = 0
        group_not_selected = 0
        
        for index, doc in enumerate(all_ranked):
            cid = doc["_id"]
            new_rank = index + 1
            is_allocated = cid in allocated_ids
            
            seat_type = seat_type_by_id.get(cid) if is_allocated else None
            seat_status = SEAT_ALLOCATED_LABEL if is_allocated else NOT_SELECTED_LABEL
            
            update_body = {
                "finalRank": new_rank,
                "seatType": seat_type,
                "seatAllocationStatus": seat_status,
                "seatAllocatedAt": datetime.utcnow() if is_allocated else None,
                "seatAllocationScope": {"department": group_department, "institute": group_institute},
                "updated_at": datetime.utcnow(),
            }
            
            if is_allocated and seat_type == "VISVESVARAYA":
                update_body.update(assign_visvesvaraya_fellowship(doc))
                
            await applications_collection.update_one({"_id": cid}, {"$set": update_body})
            
            updated_candidates_count += 1
            if is_allocated:
                group_allocated += 1
                total_allocated_candidates += 1
            else:
                group_not_selected += 1
                total_not_selected_candidates += 1

        groups_summary.append({
            "department": group_department,
            "institute": group_institute,
            "totalSeats": total_seats_limit,
            "allocated": group_allocated,
            "lapsed": lapse_allocated,
            "notSelected": group_not_selected,
            "vacancy": vacancy_count,
            "visvesvaraya": vish_allocated,
            "merit": merit_allocated,
            "general": cat_counts["GENERAL"],
            "obc": cat_counts["OBC"],
            "mbc": cat_counts["MBC"],
            "sc_st": cat_counts["SC_ST"],
            "categoryAllocation": {
                "VISVESVARAYA": vish_allocated,
                "MERIT": merit_allocated,
                "GENERAL": cat_counts["GENERAL"],
                "OBC": cat_counts["OBC"],
                "MBC": cat_counts["MBC"],
                "SC_ST": cat_counts["SC_ST"],
                "LAPSE": lapse_allocated,
            }
        })

    return {
        "updatedCandidates": updated_candidates_count,
        "allocatedCandidates": total_allocated_candidates,
        "notSelectedCandidates": total_not_selected_candidates,
        "totalVacancy": sum(g["vacancy"] for g in groups_summary),
        "groups": sorted(groups_summary, key=lambda g: (g["department"], g["institute"])),
    }

async def promote_waitlisted_candidate_for_vacancy(vacated_application: dict) -> Optional[dict]:
    vacated_department = get_application_department(vacated_application)
    vacated_institute = get_application_institute(vacated_application)
    vacated_seat_type = str(vacated_application.get("seatType") or "").strip().upper() or None

    query = {
        "waitlist_status": "Waitlisted",
        "waitlist_rank": {"$ne": None},
    }

    candidates: List[dict] = []
    cursor = applications_collection.find(query)
    async for doc in cursor:
        if vacated_department and not departments_match(vacated_department, get_application_department(doc)):
            continue
        if vacated_institute and str(get_application_institute(doc)).strip().lower() != str(vacated_institute).strip().lower():
            continue
        candidates.append(doc)

    if not candidates:
        return None

    candidates.sort(key=lambda doc: (int(doc.get("waitlist_rank") or 0), int(doc.get("finalRank") or 0), str(doc.get("registration_id") or "")))
    promoted = candidates[0]

    await applications_collection.update_one(
        {"_id": promoted["_id"]},
        {
            "$set": {
                "seatType": vacated_seat_type or "WAITLIST_PROMOTED",
                "seatAllocationStatus": SEAT_ALLOCATED_LABEL,
                "waitlist_status": None,
                "waitlist_rank": None,
                "seatLapsedFrom": vacated_application.get("registration_id") or vacated_application.get("_id"),
                "seatPromotedAt": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        }
    )

    return {
        "application_id": promoted.get("_id"),
        "registration_id": promoted.get("registration_id"),
        "scholar_name": promoted.get("scholar_name") or ((promoted.get("personal_details") or {}).get("full_name")),
        "seatType": vacated_seat_type or "WAITLIST_PROMOTED",
        "waitlist_rank": promoted.get("waitlist_rank"),
    }

def get_required_document_keys_for_scrutiny(application_doc: dict) -> List[str]:
    personal = (application_doc or {}).get("personal_details") or {}
    category = normalize_category_for_scrutiny(personal.get("category"))
    state_type = str(personal.get("candidate_state_type") or "").strip().lower()
    mode = str(personal.get("mode_of_study") or "").strip().lower()

    required = list(SCRUTINY_REQUIRED_BASE_DOCUMENTS)

    if state_type == "puducherry ut":
        required.append("residence_certificate")

    if category and category not in {"general", "fn"}:
        required.append("community_certificate")

    if category == "obc":
        required.append("obc_certificate")

    if mode == "part time":
        required.append("aicte_affiliation")

    if category == "fn":
        required.append("sponsorship_certificate")

    # Preserve order while removing duplicates.
    return list(dict.fromkeys(required))

def evaluate_document_verification(application_doc: dict) -> tuple[bool, List[str]]:
    uploaded_files = (application_doc or {}).get("uploaded_files") or {}
    required_keys = get_required_document_keys_for_scrutiny(application_doc)
    missing_keys = [key for key in required_keys if not extract_stored_file_id(uploaded_files.get(key))]
    return len(missing_keys) == 0, missing_keys

def evaluate_pg_eligibility(application_doc: dict) -> tuple[bool, Optional[float], float, float, str, str, Optional[float]]:
    personal = (application_doc or {}).get("personal_details") or {}
    pg_details = (application_doc or {}).get("pg_details") or {}

    category = normalize_category_for_scrutiny(personal.get("category"))
    pg_marks = extract_numeric_marks(pg_details.get("cgpa_percentage"))
    minimum_required_cgpa = float(
        SCRUTINY_MIN_CGPA_BY_CATEGORY.get(category, SCRUTINY_MIN_CGPA_BY_CATEGORY["general"])
    )
    minimum_required_percentage = float(
        SCRUTINY_MIN_PERCENTAGE_BY_CATEGORY.get(category, SCRUTINY_MIN_PERCENTAGE_BY_CATEGORY["general"])
    )

    if pg_marks is None:
        return False, None, minimum_required_cgpa, minimum_required_percentage, category, "Missing", None

    if pg_marks <= 10:
        eligibility_rule = "CGPA"
        eligible = pg_marks >= minimum_required_cgpa
        percentage_equivalent = round(pg_marks * 9.5, 2)
    else:
        eligibility_rule = "Percentage"
        eligible = pg_marks >= minimum_required_percentage
        percentage_equivalent = pg_marks

    return (
        eligible,
        pg_marks,
        minimum_required_cgpa,
        minimum_required_percentage,
        category,
        eligibility_rule,
        percentage_equivalent,
    )

def get_exam_status_from_score(score: int) -> str:
    return "Qualified" if score >= PTU_ENTRANCE_QUALIFY_MARKS else "Not Eligible"

def get_preferred_file_reference(uploaded_files: dict, keys: List[str]) -> str:
    files = uploaded_files or {}
    for key in keys:
        file_id = extract_stored_file_id(files.get(key))
        if file_id:
            return file_id
    return ""

async def get_latest_file_id_for_user_fields(user_id: str, field_names: List[str]) -> str:
    if not user_id or USE_MOCK_DB:
        return ""

    try:
        query = {
            "metadata.user_id": user_id,
            "metadata.field_name": {"$in": field_names},
        }
        doc = await db["fs.files"].find_one(query, sort=[("uploadDate", -1)])
        if not doc:
            return ""
        return str(doc.get("_id") or "")
    except Exception:
        return ""

async def read_stored_file_bytes(file_id: str) -> bytes:
    source = await get_file_from_gridfs(file_id)
    if isinstance(source, Path):
        return source.read_bytes()
    return await source.read()

def draw_image_or_placeholder(pdf_canvas, image_bytes: bytes, x: float, y: float, width: float, height: float, label: str):
    pdf_canvas.rect(x, y, width, height)

    if not image_bytes:
        pdf_canvas.setFont("Helvetica", 9)
        pdf_canvas.drawCentredString(x + width / 2, y + height / 2, f"{label} not uploaded")
        return

    try:
        image_reader = ImageReader(io.BytesIO(image_bytes))
        pdf_canvas.drawImage(image_reader, x + 2, y + 2, width - 4, height - 4, preserveAspectRatio=True, mask='auto')
    except Exception:
        pdf_canvas.setFont("Helvetica", 9)
        pdf_canvas.drawCentredString(x + width / 2, y + height / 2, f"Invalid {label.lower()} file")

async def build_hall_ticket_pdf(application_doc: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    uploaded_files = application_doc.get("uploaded_files") or {}
    photo_file_id = get_preferred_file_reference(uploaded_files, ["candidate_photo", "photo", "passport_photo"])
    signature_file_id = get_preferred_file_reference(uploaded_files, ["signature", "candidate_signature", "digital_signature"])

    # Backfill from latest user uploads if historical records missed linking uploaded_files.
    if not photo_file_id:
        photo_file_id = await get_latest_file_id_for_user_fields(
            application_doc.get("scholar_id") or "",
            ["candidate_photo", "photo", "passport_photo"],
        )
    if not signature_file_id:
        signature_file_id = await get_latest_file_id_for_user_fields(
            application_doc.get("scholar_id") or "",
            ["signature", "candidate_signature"],
        )

    photo_bytes = b""
    signature_bytes = b""

    if photo_file_id:
        try:
            photo_bytes = await read_stored_file_bytes(photo_file_id)
        except Exception:
            photo_bytes = b""

    if signature_file_id:
        try:
            signature_bytes = await read_stored_file_bytes(signature_file_id)
        except Exception:
            signature_bytes = b""

    personal = application_doc.get("personal_details") or {}
    candidate_name = personal.get("full_name") or application_doc.get("scholar_name") or "N/A"
    application_id = application_doc.get("registration_id") or application_doc.get("_id") or "N/A"
    department = application_doc.get("department") or ((application_doc.get("ug_details") or {}).get("branch_department")) or "N/A"
    mode = personal.get("mode_of_study") or "N/A"
    hall_ticket_number = application_doc.get("hallTicketNumber") or derive_hall_ticket_number(application_doc)

    schedule = get_effective_exam_schedule(application_doc)
    exam_date = schedule["examDate"]
    exam_time = schedule["examTime"]
    exam_centre = schedule["examCentre"]
    reporting_time = schedule["reportingTime"]
    exam_duration = schedule["examDuration"]

    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4

    margin = 14 * mm
    content_left = margin + 6 * mm
    content_right = width - margin - 6 * mm

    # Outer frame for a cleaner, official hall-ticket look.
    c.setLineWidth(1)
    c.rect(margin, margin, width - (2 * margin), height - (2 * margin))

    c.setTitle("PTU Entrance Exam Hall Ticket")
    c.setFont("Helvetica-Bold", 15)
    c.drawCentredString(width / 2, height - 22 * mm, "Puducherry Technological University")
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(width / 2, height - 30 * mm, "PhD Entrance Exam Hall Ticket")

    ticket_banner_y = height - 42 * mm
    c.setLineWidth(0.8)
    c.rect(content_left, ticket_banner_y, content_right - content_left, 8 * mm)
    c.setFont("Helvetica-Bold", 10)
    c.drawString(content_left + 3 * mm, ticket_banner_y + 2.3 * mm, f"Hall Ticket No.: {hall_ticket_number}")
    c.setFont("Helvetica", 9)
    c.drawRightString(content_right - 3 * mm, ticket_banner_y + 2.3 * mm, "Official examination document")

    c.setFont("Helvetica", 11)
    base_y = ticket_banner_y - 7 * mm
    line_gap = 7 * mm
    hall_ticket_rows = [
        ("Candidate Name", candidate_name),
        ("Application ID", application_id),
        ("Department", department),
        ("Mode", mode),
        ("Exam Date", exam_date),
        ("Exam Time", exam_time),
        ("Reporting Time", reporting_time),
        ("Exam Duration", exam_duration),
        ("Exam Centre", exam_centre),
    ]

    details_box_height = (len(hall_ticket_rows) * line_gap) + 7 * mm
    details_box_bottom = base_y - details_box_height + 4 * mm
    c.setLineWidth(0.7)
    c.rect(content_left, details_box_bottom, content_right - content_left, details_box_height)

    for idx, (label, value) in enumerate(hall_ticket_rows):
        y = base_y - idx * line_gap - 2 * mm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(content_left + 4 * mm, y, f"{label}:")
        c.setFont("Helvetica", 10)
        c.drawString(content_left + 48 * mm, y, str(value or "N/A"))

    image_top_y = details_box_bottom - 10 * mm
    photo_x = content_left
    signature_x = content_left + 75 * mm
    image_y = image_top_y - 35 * mm
    image_w = 60 * mm
    image_h = 30 * mm

    c.setFont("Helvetica-Bold", 10)
    c.drawString(photo_x, image_top_y, "Candidate Photo")
    c.drawString(signature_x, image_top_y, "Candidate Signature")
    draw_image_or_placeholder(c, photo_bytes, photo_x, image_y, image_w, image_h, "Photo")
    draw_image_or_placeholder(c, signature_bytes, signature_x, image_y, image_w, image_h, "Signature")

    instructions_y = image_y - 14 * mm
    instructions_box_height = 70 * mm
    instructions_box_bottom = instructions_y - instructions_box_height
    c.setLineWidth(0.7)
    c.rect(content_left, instructions_box_bottom, content_right - content_left, instructions_box_height)

    c.setFont("Helvetica-Bold", 11)
    c.drawString(content_left + 3 * mm, instructions_y - 4 * mm, "Instructions")
    c.setFont("Helvetica", 9)
    instructions = [
        "1. Carry a printed copy of this hall ticket to the exam centre.",
        "2. Bring a valid photo ID proof for verification.",
        f"3. Reach the exam centre at least 30 minutes before {reporting_time}.",
        "4. Electronic devices and study materials are not allowed inside the exam hall.",
        f"5. Entrance Test Pattern: 100 MCQs, total 150 marks, duration {exam_duration}.",
        "6. Section A: 50 subject/discipline-specific questions (2 marks each = 100 marks).",
        "7. Section B: 50 English and Analytical Skills questions (1 mark each = 50 marks).",
        "8. Follow all invigilator instructions during the examination.",
    ]

    for idx, instruction in enumerate(instructions):
        c.drawString(content_left + 7 * mm, instructions_y - 10 * mm - (idx * 6.4 * mm), instruction)

    c.showPage()
    c.save()

async def copy_stored_document_to_path(file_id: str, destination: Path) -> str:
    source = await get_file_from_gridfs(file_id)

    if isinstance(source, Path):
        suffix = source.suffix
        final_path = destination.with_suffix(suffix) if (not destination.suffix and suffix) else destination
        shutil.copy2(source, final_path)
        return final_path.name

    metadata = getattr(source, "metadata", {}) or {}
    original_filename = metadata.get("original_filename") or getattr(source, "filename", "") or file_id
    suffix = Path(str(original_filename)).suffix or Path(str(getattr(source, "filename", ""))).suffix
    final_path = destination.with_suffix(suffix) if (not destination.suffix and suffix) else destination

    content = await source.read()
    with open(final_path, "wb") as output_file:
        output_file.write(content)

    return final_path.name

# Security functions
def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def normalize_email(email: str) -> str:
    return email.strip().lower()

async def resolve_application_recipient_email(app: dict, current_user: Optional[dict] = None) -> str:
    # Prefer the linked scholar account email so notifications go to the signed-in account.
    scholar_id = str(app.get("scholar_id") or "").strip()
    if scholar_id:
        scholar_user = await users_collection.find_one({"_id": scholar_id}, {"email": 1})
        scholar_email = normalize_email(str((scholar_user or {}).get("email") or ""))
        if scholar_email:
            return scholar_email

    app_scholar_email = normalize_email(str(app.get("scholar_email") or ""))
    if app_scholar_email:
        return app_scholar_email

    personal_email = normalize_email(str((app.get("personal_details") or {}).get("email") or ""))
    if personal_email:
        return personal_email

    if current_user:
        fallback_email = normalize_email(str(current_user.get("email") or ""))
        if fallback_email:
            return fallback_email

    return ""

def build_scholar_access_filter(current_user: dict, app_id: Optional[str] = None) -> dict:
    scholar_id = str(current_user.get("_id") or "").strip()
    scholar_email = normalize_email(str(current_user.get("email") or "")) if current_user.get("email") else ""

    access_conditions = []
    if scholar_id:
        access_conditions.append({"scholar_id": scholar_id})
    if scholar_email:
        access_conditions.append({"scholar_email": {"$regex": f"^{re.escape(scholar_email)}$", "$options": "i"}})
        access_conditions.append({"personal_details.email": {"$regex": f"^{re.escape(scholar_email)}$", "$options": "i"}})

    if not access_conditions:
        access_conditions = [{"scholar_id": "__invalid__"}]

    if app_id:
        return {"_id": app_id, "$or": access_conditions}

    return {"$or": access_conditions}

def get_department_from_scrutiny_role(role: str) -> str:
    value = (role or "").strip()
    if not value.startswith("scrutiny_"):
        return ""

    dept_slug = value.replace("scrutiny_", "", 1)
    return " ".join(word.capitalize() for word in dept_slug.split("_"))

def build_department_match_keys(department: Optional[str]) -> set:
    text = (department or "").strip().lower()
    if not text:
        return set()

    tokens = [token for token in re.split(r"[^a-z0-9]+", text) if token and token != "and"]
    if not tokens:
        return set()

    keys = {
        " ".join(tokens),
        "".join(tokens),
    }

    if len(tokens) > 1:
        keys.add("".join(token[0] for token in tokens))

    return keys

def departments_match(first_department: Optional[str], second_department: Optional[str]) -> bool:
    first_keys = build_department_match_keys(first_department)
    second_keys = build_department_match_keys(second_department)
    if not first_keys or not second_keys:
        return False
    return bool(first_keys & second_keys)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def build_user_response(user: dict) -> UserResponse:
    return UserResponse(
        id=user["_id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user["role"],
        department=user.get("department"),
        phone=user.get("phone"),
        created_at=user["created_at"],
        is_active=user.get("is_active", True)
    )

def build_token_response(user: dict) -> Token:
    access_token = create_access_token(data={"sub": user["_id"], "role": user["role"]})
    return Token(access_token=access_token, token_type="bearer", user=build_user_response(user))

def verify_google_credential(credential: str) -> dict:
    if not GOOGLE_CLIENT_IDS:
        raise HTTPException(status_code=503, detail="Google sign in is not configured on the server")

    last_error = None
    for client_id in GOOGLE_CLIENT_IDS:
        try:
            payload = google_id_token.verify_oauth2_token(
                credential,
                google_requests.Request(),
                client_id,
            )
            if not payload.get("email") or not payload.get("email_verified"):
                raise HTTPException(status_code=401, detail="Google account email is not verified")
            return payload
        except HTTPException:
            raise
        except ValueError as exc:
            last_error = exc

    raise HTTPException(status_code=401, detail=f"Invalid Google sign in token: {last_error}")

def generate_password_reset_token() -> str:
    if APP_ENV in {"development", "dev", "local"}:
        configured_token = os.getenv("DEV_PASSWORD_RESET_OTP", "123456").strip()
        if re.fullmatch(r"\d{6}", configured_token):
            return configured_token
    return str(secrets.randbelow(1000000)).zfill(6)

def hash_password_reset_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()

def build_password_reset_link(email: str, token: str) -> str:
    return f"{FRONTEND_URL}/?reset=true&email={quote(email)}&token={quote(token)}"

def resolve_auth_provider_after_password_reset(user: dict) -> str:
    if user.get("google_sub") or user.get("auth_provider") == "google":
        return "google_local"
    return "local"

def is_password_reset_email_configured() -> bool:
    return bool(SMTP_HOST and SMTP_PORT and SMTP_FROM_EMAIL)

def get_smtp_from_header() -> str:
    if SMTP_FROM_NAME:
        return f"{SMTP_FROM_NAME} <{SMTP_FROM_EMAIL}>"
    return SMTP_FROM_EMAIL

def send_email_sync(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: Optional[str] = None,
    attachments: Optional[List[Dict[str, str]]] = None,
) -> None:
    message = EmailMessage()
    message["From"] = get_smtp_from_header()
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_body)

    if html_body:
        message.add_alternative(html_body, subtype="html")

    for attachment in attachments or []:
        path = attachment.get("path")
        filename = attachment.get("filename") or "attachment"
        mimetype = attachment.get("mimetype") or "application/octet-stream"
        if not path or not os.path.exists(path):
            continue

        main_type, _, sub_type = mimetype.partition("/")
        if not main_type or not sub_type:
            main_type, sub_type = "application", "octet-stream"

        with open(path, "rb") as attachment_file:
            message.add_attachment(
                attachment_file.read(),
                maintype=main_type,
                subtype=sub_type,
                filename=filename,
            )

    try:
        if SMTP_USE_SSL:
            with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
                if SMTP_USERNAME and SMTP_PASSWORD:
                    smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
                smtp.send_message(message)
            return

        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as smtp:
            smtp.ehlo()
            if SMTP_USE_TLS:
                smtp.starttls()
                smtp.ehlo()
            if SMTP_USERNAME and SMTP_PASSWORD:
                smtp.login(SMTP_USERNAME, SMTP_PASSWORD)
            smtp.send_message(message)
    except smtplib.SMTPResponseException as exc:
        smtp_detail = exc.smtp_error.decode("utf-8", errors="ignore") if isinstance(exc.smtp_error, bytes) else str(exc.smtp_error)
        raise RuntimeError(f"SMTP failed for {to_email} ({subject}): {exc.smtp_code} {smtp_detail}") from exc
    except Exception as exc:
        raise RuntimeError(f"Email send failed for {to_email} ({subject}): {exc}") from exc

async def send_password_reset_email(to_email: str, otp: str) -> None:
    subject = "Your Password Reset OTP - PTU PhD Admissions"
    text_body = (
        "You requested a password reset for your PTU PhD Admission account.\n\n"
        f"Your OTP is: {otp}\n\n"
        f"This OTP expires in {PASSWORD_RESET_EXPIRE_MINUTES} minutes. "
        "If you did not request this, you can safely ignore this email."
    )
    html_body = (
        "<div style='font-family:Arial,sans-serif;max-width:480px;margin:auto'>"
        "<h2 style='color:#4a2080'>PTU PhD Admissions</h2>"
        "<p>You requested a password reset. Use the OTP below:</p>"
        f"<div style='font-size:36px;font-weight:bold;letter-spacing:8px;color:#4a2080;padding:16px 0'>{otp}</div>"
        f"<p>This OTP expires in <strong>{PASSWORD_RESET_EXPIRE_MINUTES} minutes</strong>.</p>"
        "<p style='color:#888;font-size:12px'>If you did not request this, you can safely ignore this email.</p>"
        "</div>"
    )

    await asyncio.to_thread(send_email_sync, to_email, subject, text_body, html_body)

async def send_hall_ticket_email(to_email: str, hall_ticket_path: Path) -> None:
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP is not configured")

    subject = "PTU PhD Entrance Exam Hall Ticket"
    text_body = "Your hall ticket has been generated. Please download and bring it to the exam."
    html_body = (
        "<div style='font-family:Arial,sans-serif;max-width:520px;margin:auto'>"
        "<h2 style='color:#1f2937'>PTU PhD Admissions</h2>"
        "<p>Your hall ticket has been generated. Please download and bring it to the exam.</p>"
        "</div>"
    )

    await asyncio.to_thread(
        send_email_sync,
        to_email,
        subject,
        text_body,
        html_body,
        [{
            "path": str(hall_ticket_path),
            "filename": "hall_ticket.pdf",
            "mimetype": "application/pdf",
        }],
    )

async def send_payment_receipt_email(
    to_email: str,
    candidate_name: str,
    registration_id: str,
    amount: float,
    payment_date: str,
    payment_method: Optional[str],
    transaction_id: Optional[str],
    payment_label: str = "Application Fee",
    receipt_path: Optional[Path] = None,
) -> None:
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP is not configured")

    method_text = payment_method or "Not Provided"
    txn_text = transaction_id or "Not Available"

    subject = f"PTU PhD {payment_label} Payment Receipt"
    text_body = (
        "Your payment has been received successfully.\n\n"
        f"Candidate Name: {candidate_name}\n"
        f"Registration ID: {registration_id}\n"
        f"Payment Type: {payment_label}\n"
        f"Amount Paid: INR {amount:.2f}\n"
        f"Payment Date: {payment_date}\n"
        f"Payment Method: {method_text}\n"
        f"Transaction ID: {txn_text}\n\n"
        "This is an automated receipt for your application fee payment."
    )
    html_body = (
        "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto'>"
        "<h2 style='color:#1f2937'>PTU PhD Admissions</h2>"
        "<p>Your payment has been received successfully.</p>"
        "<table style='border-collapse:collapse;width:100%;margin-top:10px'>"
        f"<tr><td style='padding:6px 0'><strong>Candidate Name:</strong></td><td>{candidate_name}</td></tr>"
        f"<tr><td style='padding:6px 0'><strong>Registration ID:</strong></td><td>{registration_id}</td></tr>"
        f"<tr><td style='padding:6px 0'><strong>Payment Type:</strong></td><td>{payment_label}</td></tr>"
        f"<tr><td style='padding:6px 0'><strong>Amount Paid:</strong></td><td>INR {amount:.2f}</td></tr>"
        f"<tr><td style='padding:6px 0'><strong>Payment Date:</strong></td><td>{payment_date}</td></tr>"
        f"<tr><td style='padding:6px 0'><strong>Payment Method:</strong></td><td>{method_text}</td></tr>"
        f"<tr><td style='padding:6px 0'><strong>Transaction ID:</strong></td><td>{txn_text}</td></tr>"
        "</table>"
        "<p style='margin-top:14px'>This is an automated receipt for your application fee payment.</p>"
        "</div>"
    )

    attachments = []
    if receipt_path and receipt_path.exists():
        attachments.append({
            "path": str(receipt_path),
            "filename": f"payment_receipt_{registration_id}.pdf",
            "mimetype": "application/pdf",
        })

    await asyncio.to_thread(send_email_sync, to_email, subject, text_body, html_body, attachments)

def _normalize_department_for_code(department: str) -> str:
    normalized = str(department or "").strip().upper()
    if not normalized:
        return ""
    normalized = normalized.replace("&", "AND")
    normalized = re.sub(r"[^A-Z0-9]+", "_", normalized)
    alias_map = {
        "CIVIL": "CE",
        "CIVIL_ENGINEERING": "CE",
        "COMPUTER_SCIENCE": "CS",
        "COMPUTER_SCIENCE_ENGINEERING": "CSE",
        "ELECTRICAL_ELECTRONICS_ENGINEERING": "EEE",
        "ELECTRONICS_COMMUNICATION_ENGINEERING": "ECE",
        "ELECTRONICS_INSTRUMENTATION_ENGINEERING": "EIE",
        "HUMANITIES_SOCIAL_SCIENCES": "HSS",
        "INFORMATION_TECHNOLOGY": "IT",
        "MECHANICAL": "ME",
        "MECHANICAL_ENGINEERING": "ME",
        "MATHEMATICS": "MATHS",
    }
    return alias_map.get(normalized, normalized)

def resolve_department_code_for_registration(department: str) -> str:
    normalized = _normalize_department_for_code(department)
    return PTU_DEPARTMENT_CODES.get(normalized, "00")

def _format_date_human(value: Any) -> str:
    if not value:
        return "N/A"
    if isinstance(value, datetime):
        return value.strftime("%d-%m-%Y")
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
        return parsed.strftime("%d-%m-%Y")
    except ValueError:
        return text

async def generate_offer_letter_pdf(application_doc: dict, output_path: Path, deadline_date: str) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    candidate_name = ((application_doc.get("personal_details") or {}).get("full_name") or application_doc.get("scholar_name") or "N/A")
    registration_id = application_doc.get("registration_id") or application_doc.get("_id") or "N/A"
    department = get_application_department(application_doc) or "N/A"
    institute = get_application_institute(application_doc) or "PTU"
    seat_type = application_doc.get("seatType") or "N/A"
    final_rank = application_doc.get("finalRank") if application_doc.get("finalRank") is not None else "N/A"

    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    margin = 18 * mm
    y = height - margin

    c.setFillColorRGB(0.93, 0.96, 1.0)
    c.rect(margin, margin, width - (2 * margin), height - (2 * margin), stroke=0, fill=1)
    c.setStrokeColorRGB(0.12, 0.28, 0.58)
    c.setLineWidth(1.2)
    c.rect(margin, margin, width - (2 * margin), height - (2 * margin), stroke=1, fill=0)

    c.setFont("Helvetica-Bold", 18)
    c.setFillColorRGB(0.08, 0.22, 0.45)
    c.drawCentredString(width / 2, y, "PhD Admission Offer Letter")
    y -= 12 * mm

    c.setFont("Helvetica", 11)
    c.setFillColorRGB(0.1, 0.1, 0.1)
    c.drawString(margin + 8 * mm, y, f"Date: {_format_date_human(datetime.utcnow())}")
    y -= 8 * mm
    c.drawString(margin + 8 * mm, y, f"Reference No: {registration_id}")
    y -= 12 * mm

    lines = [
        f"Candidate Name: {candidate_name}",
        f"Department: {department}",
        f"Institute: {institute}",
        f"Seat Type: {seat_type}",
        f"Final Rank: {final_rank}",
        f"Admission Deadline: {_format_date_human(deadline_date)}",
    ]

    c.setFont("Helvetica", 12)
    for line in lines:
        c.drawString(margin + 8 * mm, y, line)
        y -= 8 * mm

    y -= 4 * mm
    body_lines = [
        "Dear Candidate,",
        "",
        "Congratulations. You are provisionally offered admission to the PhD programme",
        "based on the approved merit and seat allocation process.",
        "",
        "Please confirm your acceptance before the deadline mentioned above.",
        "Failure to respond within the deadline will be treated as non-acceptance.",
    ]

    c.setFont("Helvetica", 11)
    for line in body_lines:
        c.drawString(margin + 8 * mm, y, line)
        y -= 7 * mm

    y -= 10 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(margin + 8 * mm, y, "Director (Research)")
    y -= 6 * mm
    c.setFont("Helvetica", 10)
    c.drawString(margin + 8 * mm, y, "PTU PhD Admissions")

    c.save()

async def send_offer_letter_email(to_email: str, offer_letter_path: Path, registration_id: str) -> None:
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP is not configured")

    subject = "PhD Admission Offer Letter"
    text_body = (
        "Your PhD admission offer letter has been generated."
        f"\n\nReference: {registration_id}\nPlease review the attached offer letter and submit your admission response."
    )
    html_body = (
        "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto'>"
        "<h2 style='color:#1e3a8a'>PhD Admission Offer Letter</h2>"
        f"<p>Your offer letter has been generated. <strong>Reference: {registration_id}</strong>.</p>"
        "<p>Please review the attached offer letter and submit your admission response.</p>"
        "</div>"
    )

    await asyncio.to_thread(
        send_email_sync,
        to_email,
        subject,
        text_body,
        html_body,
        [{
            "path": str(offer_letter_path),
            "filename": f"offer_letter_{registration_id}.pdf",
            "mimetype": "application/pdf",
        }],
    )

async def get_confirmed_student_count(department: str, institute: str) -> int:
    count = 0
    cursor = applications_collection.find(
        {"status": ApplicationStatus.ADMISSION_CONFIRMED.value},
        {"department": 1, "institute": 1, "personal_details": 1}
    )
    async for doc in cursor:
        doc_department = get_application_department(doc)
        doc_institute = get_application_institute(doc)
        if str(doc_department).strip().lower() == str(department).strip().lower() and str(doc_institute).strip().lower() == str(institute).strip().lower():
            count += 1
    return count

async def generate_unique_registration_number(application_doc: dict) -> str:
    department = get_application_department(application_doc) or ""
    institute = get_application_institute(application_doc) or "PTU"
    dept_code = resolve_department_code_for_registration(department)

    serial_count = await get_confirmed_student_count(department, institute) + 1

    while True:
        registration_number = f"{PTU_REGISTRATION_YEAR}{PTU_PROGRAM_CODE}{dept_code}{str(serial_count).zfill(3)}"
        existing = await applications_collection.find_one({"registrationNumber": registration_number})
        if not existing:
            return registration_number
        serial_count += 1

async def generate_joining_letter_pdf(application_doc: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    candidate_name = ((application_doc.get("personal_details") or {}).get("full_name") or application_doc.get("scholar_name") or "N/A")
    registration_number = application_doc.get("registrationNumber") or "Pending"
    department = get_application_department(application_doc) or "N/A"
    institute = get_application_institute(application_doc) or "PTU"
    joining_date = application_doc.get("joiningDate") or datetime.utcnow().date().isoformat()
    research_area = ((application_doc.get("research_info") or {}).get("area_of_interest") or application_doc.get("area_of_interest") or "N/A")

    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4
    margin = 20 * mm
    y = height - margin

    c.setFont("Helvetica", 11)
    c.setFillColorRGB(0.1, 0.1, 0.1)

    def draw_wrapped(text: str, x: float, font_name: str = "Helvetica", font_size: int = 11, max_width: float = None, line_step: float = 6 * mm):
        nonlocal y
        if max_width is None:
            max_width = width - margin - x - 8 * mm
        words = str(text or "").split()
        if not words:
            y -= line_step
            return
        current = words[0]
        c.setFont(font_name, font_size)
        for word in words[1:]:
            trial = f"{current} {word}"
            if c.stringWidth(trial, font_name, font_size) <= max_width:
                current = trial
            else:
                c.drawString(x, y, current)
                y -= line_step
                current = word
        c.drawString(x, y, current)
        y -= line_step

    body_x = margin + 2 * mm
    admission_ref = application_doc.get("admissionReference") or application_doc.get("offerLetterRef") or "Admission Order Reference"
    joining_date_text = _format_date_human(joining_date)

    c.drawRightString(width - margin, y, f"Date: {joining_date_text}")
    y -= 11 * mm

    c.drawString(body_x, y, "From")
    y -= 6 * mm
    c.drawString(body_x, y, candidate_name)
    y -= 6 * mm
    c.drawString(body_x, y, department)
    y -= 6 * mm
    c.drawString(body_x, y, "Puducherry Technological University")
    y -= 10 * mm

    c.drawString(body_x, y, "To")
    y -= 6 * mm
    c.drawString(body_x, y, "Director (Research)")
    y -= 6 * mm
    c.drawString(body_x, y, "Puducherry Technological University")
    y -= 6 * mm
    c.drawString(body_x, y, "Puducherry.")
    y -= 10 * mm

    c.drawString(body_x, y, "Sir/Madam,")
    y -= 8 * mm

    c.drawString(body_x + 27 * mm, y, "Sub: Submission of admission documents - reg.")
    y -= 6 * mm
    c.drawString(body_x + 27 * mm, y, f"Ref: {admission_ref}")
    y -= 10 * mm

    draw_wrapped(
        f"With reference to above letter I wish to inform you that I am submitting the following documents. "
        f"I may please be permitted to join the research scholar in the department of {department} on {joining_date_text}",
        body_x,
        "Helvetica",
        11,
    )
    y -= 4 * mm

    draw_wrapped(research_area, body_x, "Helvetica", 11)
    y -= 7 * mm

    c.drawString(body_x, y, "Thanking you,")
    y -= 8 * mm
    c.drawString(width / 2 + 15 * mm, y, "Yours faithfully,")
    y -= 7 * mm
    c.drawString(width / 2 + 15 * mm, y, candidate_name)
    y -= 9 * mm

    c.setFont("Helvetica", 11)
    c.drawString(body_x, y, "List of Enclosures:")
    y -= 7 * mm

    c.setFont("Helvetica", 10)
    enclosures = [
        "1. Admission order from PTU (Copy)",
        "2. Ph.D admission Form",
        "3. Undertaking form",
        "4. Registration form with Supervisor Signature",
        "   (For Supervisor from PKIET signed scan copy of the signed registration form in Pdf)",
        "5. Qualifying degree certificate and mark list and other certificates claiming certificates (original and two sets of attested copies)",
        "6. NoC from the employer in case Part Time candidate and Full Time Govt. Employees (original)",
        "7. Relieving certificate in case of the fulltime candidate who is an employee at the time of Applying for Ph.D",
    ]
    for enclosure in enclosures:
        draw_wrapped(enclosure, body_x, "Helvetica", 10, line_step=5.5 * mm)

    y -= 3 * mm
    c.setFont("Helvetica-Oblique", 10)
    draw_wrapped("The candidate may be permitted to pay the fees and register for the PhD. programme.", body_x, "Helvetica-Oblique", 10)

    y -= 3 * mm
    c.setFont("Helvetica", 10)
    c.drawString(body_x, y, "HoD")
    y -= 10 * mm
    c.drawString(body_x, y, "Approved Director (Research)")

    c.save()

async def send_joining_letter_email(to_email: str, joining_letter_path: Path, registration_number: str) -> None:
    if not SMTP_HOST or not SMTP_FROM_EMAIL:
        raise RuntimeError("SMTP is not configured")

    subject = "PhD Joining Letter"
    text_body = (
        "Your joining letter has been generated after admission confirmation."
        f"\n\nRegistration Number: {registration_number}\nPlease keep this letter for your records."
    )
    html_body = (
        "<div style='font-family:Arial,sans-serif;max-width:560px;margin:auto'>"
        "<h2 style='color:#1e3a8a'>PhD Joining Letter</h2>"
        f"<p>Your joining letter has been generated. <strong>Registration Number: {registration_number}</strong>.</p>"
        "<p>Please keep the attached document for your records.</p>"
        "</div>"
    )

    await asyncio.to_thread(
        send_email_sync,
        to_email,
        subject,
        text_body,
        html_body,
        [{
            "path": str(joining_letter_path),
            "filename": f"joining_letter_{registration_number}.pdf",
            "mimetype": "application/pdf",
        }],
    )

async def build_payment_receipt_pdf(payment_doc: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    candidate_name = (payment_doc.get("candidateName") or "N/A").strip()
    registration_id = (payment_doc.get("registrationId") or "N/A").strip()
    department = (payment_doc.get("department") or "N/A").strip()
    mode_of_study = (payment_doc.get("modeOfStudy") or "N/A").strip()
    category = (payment_doc.get("category") or "N/A").strip()
    email = (payment_doc.get("email") or "N/A").strip()
    mobile = (payment_doc.get("mobile") or "N/A").strip()
    payment_date = payment_doc.get("paymentDate") or "N/A"
    payment_method = payment_doc.get("paymentMethod") or "N/A"
    transaction_id = payment_doc.get("transactionId") or "N/A"
    payment_ref_number = payment_doc.get("paymentRefNo") or transaction_id
    payment_type = (payment_doc.get("paymentType") or "Application Fee").strip() or "Application Fee"
    remarks = (payment_doc.get("remarks") or "NA").strip()
    amount = float(payment_doc.get("amount") or 0)

    def _format_datetime(value: Any) -> str:
        if not value:
            return "N/A"
        if isinstance(value, datetime):
            return value.strftime("%d-%m-%Y %H:%M:%S")
        text = str(value).strip()
        try:
            parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
            return parsed.strftime("%d-%m-%Y %H:%M:%S")
        except Exception:
            return text

    def _amount_words(value: float) -> str:
        ones = [
            "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
            "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"
        ]
        tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"]

        def two_digits(n: int) -> str:
            if n < 20:
                return ones[n]
            return (tens[n // 10] + (" " + ones[n % 10] if n % 10 else "")).strip()

        def three_digits(n: int) -> str:
            if n == 0:
                return ""
            if n < 100:
                return two_digits(n)
            rem = n % 100
            return (ones[n // 100] + " Hundred" + (" " + two_digits(rem) if rem else "")).strip()

        rupees = int(value)
        paise = int(round((value - rupees) * 100))
        if paise == 100:
            rupees += 1
            paise = 0

        if rupees == 0:
            rupee_words = "Zero"
        else:
            crore = rupees // 10000000
            rupees %= 10000000
            lakh = rupees // 100000
            rupees %= 100000
            thousand = rupees // 1000
            rupees %= 1000
            parts: List[str] = []
            if crore:
                parts.append(f"{three_digits(crore)} Crore")
            if lakh:
                parts.append(f"{three_digits(lakh)} Lakh")
            if thousand:
                parts.append(f"{three_digits(thousand)} Thousand")
            if rupees:
                parts.append(three_digits(rupees))
            rupee_words = " ".join(part.strip() for part in parts if part).strip()

        paise_words = two_digits(paise) if paise else "Zero"
        return f"{rupee_words} Rupees and {paise_words} Paise Only."

    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4

    left = 16 * mm
    right = width - 16 * mm
    y = height - 34 * mm

    c.setFillColorRGB(0.95, 0.95, 0.95)
    c.rect(0, 0, width, height, stroke=0, fill=1)

    c.setFillColorRGB(1, 1, 1)
    c.rect(left, 18 * mm, right - left, height - 36 * mm, stroke=0, fill=1)

    c.setFillColorRGB(0.0, 0.0, 0.0)
    c.setFont("Times-Bold", 14)
    c.drawCentredString((left + right) / 2, y, "Puducherry Technological University")
    y -= 6 * mm
    c.setFont("Times-Bold", 10)
    c.drawCentredString((left + right) / 2, y, "East Coast Road, Pillaiyarchavadi, Puducherry, 605014")
    y -= 8 * mm
    c.setFont("Times-Bold", 15)
    c.drawCentredString((left + right) / 2, y, "PAYMENT RECEIPT")

    y -= 11 * mm
    c.setFillColorRGB(0.08, 0.44, 0.67)
    c.rect(left, y - 7 * mm, right - left, 7 * mm, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Times-Bold", 11)
    c.drawCentredString((left + right) / 2, y - 4.9 * mm, f"Amount Paid : Rs. {amount:,.2f}")

    y -= 11 * mm
    c.setFillColorRGB(0.0, 0.0, 0.0)
    c.setFont("Times-Bold", 10)
    c.drawString(left + 2 * mm, y, f"Amount in words : {_amount_words(amount)}")

    def draw_header(title: str, top_y: float, blue: bool = False) -> float:
        if blue:
            c.setFillColorRGB(0.08, 0.44, 0.67)
            c.setFillColorRGB(0.08, 0.44, 0.67)
        else:
            c.setFillColorRGB(0.75, 0.75, 0.75)
        c.rect(left, top_y - 8 * mm, right - left, 8 * mm, stroke=0, fill=1)
        c.setFillColorRGB(1, 1, 1) if blue else c.setFillColorRGB(0.08, 0.08, 0.08)
        c.setFont("Times-Bold", 12)
        c.drawString(left + 4 * mm, top_y - 5.5 * mm, title)
        return top_y - 12 * mm

    def draw_rows(rows: List[tuple[str, str]], top_y: float, row_h: float = 6.2 * mm) -> float:
        label_x = left + 3 * mm
        value_x = left + 88 * mm
        y_row = top_y
        for label, value in rows:
            c.setFillColorRGB(0.0, 0.0, 0.0)
            c.setFont("Times-Bold", 10)
            c.drawString(label_x, y_row, f"{label} :")
            c.setFont("Times-Bold", 10)
            c.drawString(value_x, y_row, str(value or "N/A"))
            y_row -= row_h
        return y_row

    y -= 8 * mm
    y = draw_header("Transaction Details", y, blue=False)
    transaction_rows = [
        ("Transaction Status", "SUCCESSFUL"),
        ("Transaction Date-Time", _format_datetime(payment_date)),
        ("Transaction ID", str(transaction_id or "N/A")),
        ("Payment Ret No", str(payment_ref_number or "N/A")),
    ]
    y = draw_rows(transaction_rows, y)

    y -= 4 * mm
    y = draw_header("Student Details", y, blue=False)
    student_rows = [
        ("Student Name", candidate_name),
        ("Reg. No.", registration_id),
        ("Department", department),
        ("Mode of Study", mode_of_study),
        ("Category", category),
        ("E Mail Id", email),
        ("Mobile Number", mobile),
        ("Payment Type", payment_type),
        ("Remarks.", remarks),
    ]
    y = draw_rows(student_rows, y)

    y -= 4 * mm
    y = draw_header("Payment Summary", y, blue=False)
    summary_rows = [
        ("Total", f"{amount:,.2f}"),
        ("Net-total", f"{amount:,.2f}"),
    ]
    y = draw_rows(summary_rows, y)

    y -= 4 * mm
    y = draw_header("Payment Description", y, blue=True)

    c.setFillColorRGB(0.0, 0.0, 0.0)
    c.setFont("Times-Bold", 10)
    c.drawString(left + 3 * mm, y, f"{payment_type} Details")
    c.drawString(left + 85 * mm, y, f"Amount: Rs.{amount:,.2f}")
    c.drawString(left + 145 * mm, y, f"Total: Rs.{amount:,.2f}")

    y -= 8 * mm
    c.setFont("Times-Bold", 10)
    c.drawString(left + 3 * mm, y, f"{payment_type} (-)")
    c.drawString(left + 85 * mm, y, f"Amount: Rs.{amount:,.2f}")
    c.drawString(left + 145 * mm, y, f"Total: Rs.{amount:,.2f}")

    y -= 12 * mm
    c.setFont("Times-Bold", 10)
    c.drawString(left + 3 * mm, y, "Note : This is a computer generated receipt and does not require signature.")

    y -= 9 * mm
    c.setFont("Times-Bold", 10)
    c.drawString(left + 3 * mm, y, f"Receipt Generated Date & Time : {_format_datetime(datetime.utcnow())}")

    c.showPage()
    c.save()

async def build_scrutiny_verification_receipt_pdf(application_doc: dict, output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)

    scrutiny = (application_doc or {}).get("scrutiny") or {}
    personal = (application_doc or {}).get("personal_details") or {}
    registration_id = (application_doc or {}).get("registration_id") or (application_doc or {}).get("_id") or "N/A"
    candidate_name = personal.get("full_name") or (application_doc or {}).get("scholar_name") or "N/A"
    department = (application_doc or {}).get("department") or ((application_doc or {}).get("ug_details") or {}).get("branch_department") or "N/A"
    category = personal.get("category") or "N/A"
    scrutiny_status = str(
        (application_doc or {}).get("scrutiny_status")
        or (application_doc or {}).get("scrutinyStatus")
        or scrutiny.get("status")
        or "pending"
    ).strip().lower()
    scrutiny_officer = scrutiny.get("scrutiny_officer_name") or "N/A"
    scrutinized_at = scrutiny.get("scrutinized_at") or datetime.utcnow().isoformat()
    remarks = scrutiny.get("remarks") or "NA"

    c = canvas.Canvas(str(output_path), pagesize=A4)
    width, height = A4

    left = 18 * mm
    right = width - 18 * mm
    y = height - 28 * mm

    c.setFillColorRGB(0.97, 0.97, 0.97)
    c.rect(0, 0, width, height, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    c.rect(left, 18 * mm, right - left, height - 36 * mm, stroke=0, fill=1)

    c.setFillColorRGB(0.0, 0.0, 0.0)
    c.setFont("Times-Bold", 14)
    c.drawCentredString((left + right) / 2, y, "Puducherry Technological University")
    y -= 6 * mm
    c.setFont("Times-Bold", 10)
    c.drawCentredString((left + right) / 2, y, "SCRUTINY VERIFICATION RECEIPT")

    y -= 10 * mm
    c.setFillColorRGB(0.08, 0.44, 0.67)
    c.rect(left, y - 7 * mm, right - left, 7 * mm, stroke=0, fill=1)
    c.setFillColorRGB(1, 1, 1)
    c.setFont("Times-Bold", 11)
    c.drawCentredString((left + right) / 2, y - 4.8 * mm, "Scrutiny Status: APPROVED")

    y -= 14 * mm
    c.setFillColorRGB(0.0, 0.0, 0.0)
    c.setFont("Times-Bold", 10)
    rows = [
        ("Student Name", candidate_name),
        ("Registration ID", registration_id),
        ("Department", department),
        ("Category", category),
        ("Scrutiny Officer", scrutiny_officer),
        ("Scrutiny Date", str(scrutinized_at)),
        ("Scrutiny Result", "Approved" if scrutiny_status in {"approved", "verified"} else scrutiny_status.title()),
        ("Remarks", remarks),
    ]

    label_x = left + 4 * mm
    value_x = left + 68 * mm
    for label, value in rows:
        c.drawString(label_x, y, f"{label} :")
        c.drawString(value_x, y, str(value or "N/A"))
        y -= 7 * mm

    y -= 4 * mm
    c.setFont("Times-Bold", 10)
    c.drawString(left + 4 * mm, y, "This receipt confirms that scrutiny verification is completed and approved.")
    y -= 7 * mm
    c.drawString(left + 4 * mm, y, "You are eligible to proceed to the Entrance Examination application process.")

    c.showPage()
    c.save()

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = await users_collection.find_one({"_id": user_id})
    if user is None:
        raise credentials_exception
    
    return user

def require_role(allowed_roles: List[UserRole], allow_scrutiny: bool = False, allow_dean_variants: bool = False):
    async def role_checker(current_user: dict = Depends(get_current_user)):
        user_role = current_user["role"]
        allowed_role_values = [role.value for role in allowed_roles]
        
        # Check for exact match
        if user_role in allowed_role_values:
            return current_user
        
        # Check for dean variants (dean_1, dean_2, etc.)
        if allow_dean_variants and user_role.startswith('dean_') and 'dean' in allowed_role_values:
            return current_user
        
        # Check for scrutiny roles
        if allow_scrutiny and user_role.startswith('scrutiny_'):
            return current_user
        
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to access this resource"
        )
    return role_checker

# Startup event to test MongoDB connection
@app.on_event("startup")
async def startup_db_client():
    global db, USE_MOCK_DB, users_collection, applications_collection, reviews_collection, notifications_collection, fs_bucket
    
    try:
        if not MONGODB_URL:
            raise RuntimeError("MONGODB_URL is not set. Configure backend/.env with your MongoDB connection string.")

        # Test the MongoDB connection
        await db.command('ping')
        print(f"✅ Connected to MongoDB successfully!")
        print(f"📚 Using database: '{DATABASE_NAME}'")
        USE_MOCK_DB = False
        
        # Initialize collections with MongoDB
        users_collection = db["users"]
        applications_collection = db["applications"]
        reviews_collection = db["reviews"]
        notifications_collection = db["notifications"]
        
        # Initialize GridFS bucket for storing uploaded documents
        fs_bucket = AsyncIOMotorGridFSBucket(db)
        print("📁 GridFS initialized for document storage")
        
    except Exception as e:
        print(f"❌ Failed to connect to MongoDB: {e}")

        if not ALLOW_MOCK_FALLBACK:
            raise RuntimeError(
                "MongoDB connection failed and mock fallback is disabled. "
                "Set a valid MONGODB_URL (and DATABASE_NAME) in backend/.env and restart backend."
            ) from e

        print("🔄 Switching to MOCK DATABASE mode for development")
        print("⚠️ WARNING: Mock database data is NOT persistent (memory only)")
        
        # Import and switch to mock database
        from mock_db import MockDatabase
        USE_MOCK_DB = True
        db = MockDatabase()
        # Initialize collections with Mock Database
        users_collection = db["users"]
        applications_collection = db["applications"]
        reviews_collection = db["reviews"]
        notifications_collection = db["notifications"]
        
        # Seed initial data for testing
        admin_user = {
            "_id": "admin_001",
            "email": "admin@phd.edu",
            "full_name": "AKSHU",
            "role": "admin",
            "department": "Administration",
            "phone": "+1-800-0000",
            "hashed_password": get_password_hash("admin@123"),
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        
        faculty_users = [
            {
                "_id": "faculty_001",
                "email": "prof.smith@phd.edu",
                "full_name": "Prof. Smith",
                "role": "faculty",
                "department": "Computer Science",
                "phone": "+1-555-0001",
                "hashed_password": get_password_hash("faculty@123"),
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "_id": "faculty_002",
                "email": "prof.johnson@phd.edu",
                "full_name": "Prof. Johnson",
                "role": "faculty",
                "department": "Engineering",
                "phone": "+1-555-0002",
                "hashed_password": get_password_hash("faculty@123"),
                "is_active": True,
                "created_at": datetime.utcnow()
            }
        ]
        
        scholar_users = [
            {
                "_id": "scholar_001",
                "email": "scholar1@phd.edu",
                "full_name": "John Doe",
                "role": "scholar",
                "department": "Computer Science",
                "phone": "+1-555-1001",
                "hashed_password": get_password_hash("scholar@123"),
                "is_active": True,
                "created_at": datetime.utcnow()
            },
            {
                "_id": "scholar_002",
                "email": "scholar2@phd.edu",
                "full_name": "Jane Smith",
                "role": "scholar",
                "department": "Engineering",
                "phone": "+1-555-1002",
                "hashed_password": get_password_hash("scholar@123"),
                "is_active": True,
                "created_at": datetime.utcnow()
            }
        ]
        
        director_user = {
            "_id": "director_001",
            "email": "director@phd.edu",
            "full_name": "Dr. David Lee",
            "role": "director",
            "department": "Academic Affairs",
            "phone": "+1-555-2001",
            "hashed_password": get_password_hash("director@123"),
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        
        dean_user = {
            "_id": "dean_001",
            "email": "dean@phd.edu",
            "full_name": "Dr. Patricia Adams",
            "role": "dean",
            "department": "Graduate Studies",
            "phone": "+1-555-3001",
            "hashed_password": get_password_hash("dean@123"),
            "is_active": True,
            "created_at": datetime.utcnow()
        }
        
        # Insert all users into the collection
        await users_collection.insert_one(admin_user)
        for user in faculty_users:
            await users_collection.insert_one(user)
        for user in scholar_users:
            await users_collection.insert_one(user)
        await users_collection.insert_one(director_user)
        await users_collection.insert_one(dean_user)
        
        print("✅ Mock database initialized with seed data - Ready for testing!")
        print(f"   📊 Loaded {len(faculty_users) + len(scholar_users) + 3} users into mock database")

# API Endpoints

@app.get("/")
async def root():
    return {"message": "PhD Admission Scrutinization System API", "status": "active"}

# Authentication Endpoints
@app.post("/api/register", response_model=UserResponse)
async def register(user: UserCreate):
    normalized_email = normalize_email(user.email)

    print(f"📥 Registration request received for: {normalized_email}")
    print(f"   Full Name: {user.full_name}")
    print(f"   Role: {user.role}")
    print(f"   Department: {user.department}")
    print(f"   Phone: {user.phone}")
    
    try:
        # Debug: Check if collections are initialized
        if users_collection is None:
            print("❌ ERROR: users_collection is None!")
            raise HTTPException(status_code=500, detail="Database not initialized")
        
        # Check if user exists
        existing_user = await users_collection.find_one({"email": normalized_email})
        if existing_user:
            print(f"❌ Email already registered: {normalized_email}")
            raise HTTPException(status_code=400, detail="Email already registered")
        
        # Normalize role - convert dean_1, dean_2, etc. to dean
        normalized_role = user.role
        original_role = user.role  # Keep original for scrutiny roles
        if normalized_role.startswith('dean_'):
            normalized_role = 'dean'
        
        # Validate role - also accept scrutiny roles
        valid_roles = ['scholar', 'faculty', 'admin', 'director', 'dean']
        is_scrutiny_role = user.role.startswith('scrutiny_')
        
        if not is_scrutiny_role and normalized_role not in valid_roles:
            raise HTTPException(status_code=400, detail=f"Invalid role: {user.role}")
        
        # Create user
        user_id = f"{normalized_role}_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
        hashed_password = get_password_hash(user.password)
        
        user_doc = {
            "_id": user_id,
            "email": normalized_email,
            "full_name": user.full_name,
            "role": original_role if is_scrutiny_role else normalized_role,
            "department": user.department,
            "phone": user.phone,
            "hashed_password": hashed_password,
            "created_at": datetime.utcnow(),
            "is_active": True,
            "auth_provider": "local"
        }
        
        await users_collection.insert_one(user_doc)
        
        print(f"✅ User registered successfully: {normalized_email} ({normalized_role})")
        
        return UserResponse(
            id=user_id,
            email=normalized_email,
            full_name=user.full_name,
            role=original_role if is_scrutiny_role else normalized_role,
            department=user.department,
            phone=user.phone,
            created_at=user_doc["created_at"],
            is_active=True
        )
    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Registration error: {type(e).__name__}: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(
            status_code=500, 
            detail=f"Registration failed: {str(e)}"
        )

@app.post("/api/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    email = normalize_email(form_data.username)
    user = await users_collection.find_one({"email": email})
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("hashed_password"):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google sign in. Please continue with Google.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(form_data.password, user["hashed_password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="User account is deactivated")

    return build_token_response(user)

@app.post("/api/forgot-password", response_model=ForgotPasswordResponse)
async def forgot_password(payload: ForgotPasswordRequest):
    normalized_email = normalize_email(payload.email)
    generic_message = "If an account with that email exists, a reset link has been sent."
    email_delivery_enabled = is_password_reset_email_configured()

    if not email_delivery_enabled and not PASSWORD_RESET_RETURN_TOKEN:
        raise HTTPException(status_code=503, detail="Password reset email is not configured on the server")

    user = await users_collection.find_one({"email": normalized_email})
    if not user or not user.get("is_active", True):
        return ForgotPasswordResponse(message=generic_message)

    reset_token = generate_password_reset_token()
    token_hash = hash_password_reset_token(reset_token)
    expires_at = datetime.utcnow() + timedelta(minutes=PASSWORD_RESET_EXPIRE_MINUTES)

    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "password_reset_token_hash": token_hash,
                "password_reset_expires_at": expires_at,
                "password_reset_requested_at": datetime.utcnow(),
            }
        },
    )

    print(f"🔐 Password reset OTP requested for {normalized_email}")
    print(f"   OTP expires at: {expires_at.isoformat()} UTC")

    if email_delivery_enabled:
        try:
            await send_password_reset_email(normalized_email, reset_token)
            print("   OTP email sent successfully")
        except Exception as exc:
            print(f"❌ Failed to send OTP email to {normalized_email}: {exc}")
            await users_collection.update_one(
                {"_id": user["_id"]},
                {
                    "$unset": {
                        "password_reset_token_hash": "",
                        "password_reset_expires_at": "",
                        "password_reset_requested_at": "",
                    }
                },
            )
            raise HTTPException(
                status_code=503,
                detail="Unable to deliver reset OTP email right now. Please try again later.",
            )

    if PASSWORD_RESET_RETURN_TOKEN:
        return ForgotPasswordResponse(
            message="OTP generated for development. Use it to set a new password.",
            reset_token=reset_token,
            expires_in_minutes=PASSWORD_RESET_EXPIRE_MINUTES,
        )

    return ForgotPasswordResponse(
        message="An OTP has been sent to your email address. Enter it below to reset your password.",
        expires_in_minutes=PASSWORD_RESET_EXPIRE_MINUTES,
    )

@app.post("/api/reset-password", response_model=PasswordResetResponse)
async def reset_password(payload: ResetPasswordRequest):
    normalized_email = normalize_email(payload.email)
    reset_token = payload.token.strip()

    if not reset_token:
        raise HTTPException(status_code=400, detail="Reset token is required")

    user = await users_collection.find_one({"email": normalized_email})
    if not user:
        raise HTTPException(status_code=400, detail="No account found for this email. Please check your email address.")

    if not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="This account is deactivated. Please contact support.")

    stored_hash = user.get("password_reset_token_hash")
    expires_at = user.get("password_reset_expires_at")
    provided_hash = hash_password_reset_token(reset_token)

    if not stored_hash or not expires_at:
        raise HTTPException(status_code=400, detail="No reset OTP found. Please request a new OTP.")

    if expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Reset OTP has expired. Please request a new OTP.")

    if stored_hash != provided_hash:
        raise HTTPException(status_code=400, detail="Invalid reset OTP. Please enter the latest OTP sent to your email.")

    await users_collection.update_one(
        {"_id": user["_id"]},
        {
            "$set": {
                "hashed_password": get_password_hash(payload.new_password),
                "auth_provider": resolve_auth_provider_after_password_reset(user),
            },
            "$unset": {
                "password_reset_token_hash": "",
                "password_reset_expires_at": "",
                "password_reset_requested_at": "",
            },
        },
    )

    if user.get("google_sub") or user.get("auth_provider") == "google":
        return PasswordResetResponse(message="Password reset successful. You can now sign in with your password or continue with Google.")

    return PasswordResetResponse(message="Password reset successful. Please sign in with your new password.")

@app.post("/api/google-login", response_model=Token)
async def google_login(payload: GoogleLoginRequest):
    google_user = verify_google_credential(payload.credential)
    email = normalize_email(google_user["email"])

    user = await users_collection.find_one({"email": email})

    if user and not user.get("is_active", True):
        raise HTTPException(status_code=400, detail="User account is deactivated")

    if not user:
        user = {
            "_id": f"scholar_{datetime.now().strftime('%Y%m%d%H%M%S%f')}",
            "email": email,
            "full_name": google_user.get("name") or email.split("@")[0],
            "role": UserRole.SCHOLAR.value,
            "department": None,
            "phone": None,
            "created_at": datetime.utcnow(),
            "is_active": True,
            "auth_provider": "google",
            "google_sub": google_user.get("sub"),
        }
        await users_collection.insert_one(user)
    elif google_user.get("sub") and user.get("google_sub") != google_user.get("sub"):
        await users_collection.update_one(
            {"_id": user["_id"]},
            {"$set": {"google_sub": google_user.get("sub")}},
        )
        user["google_sub"] = google_user.get("sub")

    return build_token_response(user)

@app.get("/api/me", response_model=UserResponse)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    return build_user_response(current_user)

# Helper functions for GridFS file storage
async def save_file_to_gridfs(file: UploadFile, user_id: str, field_name: str) -> str:
    """Save uploaded file to MongoDB GridFS and return the file_id"""
    try:
        if USE_MOCK_DB:
            # Fallback to local storage if using mock database
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_extension = os.path.splitext(file.filename)[1]
            unique_filename = f"{user_id}_{field_name}_{timestamp}{file_extension}"
            file_path = UPLOAD_DIR / unique_filename
            
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            return unique_filename
        else:
            # Store in MongoDB GridFS
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            file_extension = os.path.splitext(file.filename)[1]
            filename = f"{user_id}_{field_name}_{timestamp}{file_extension}"
            
            # Read file content
            content = await file.read()
            
            # Upload to GridFS with metadata
            file_id = await fs_bucket.upload_from_stream(
                filename,
                io.BytesIO(content),
                metadata={
                    "user_id": user_id,
                    "field_name": field_name,
                    "original_filename": file.filename,
                    "content_type": file.content_type,
                    "upload_date": datetime.now()
                }
            )
            
            return str(file_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File storage failed: {str(e)}")

async def get_file_from_gridfs(file_id: str):
    """Retrieve file from MongoDB GridFS"""
    try:
        if USE_MOCK_DB:
            # Fallback to local storage
            file_path = UPLOAD_DIR / file_id
            if not file_path.exists():
                raise HTTPException(status_code=404, detail="File not found")
            return file_path
        else:
            # Retrieve from MongoDB GridFS
            from bson import ObjectId, errors as bson_errors

            try:
                grid_out = await fs_bucket.open_download_stream(ObjectId(file_id))
                return grid_out
            except (bson_errors.InvalidId, TypeError):
                # Backward compatibility: older records may store filename instead of GridFS ObjectId.
                legacy_doc = await db["fs.files"].find_one(
                    {"filename": file_id},
                    sort=[("uploadDate", -1)]
                )
                if not legacy_doc:
                    raise HTTPException(status_code=404, detail="File not found")

                grid_out = await fs_bucket.open_download_stream(legacy_doc["_id"])
                return grid_out
    except Exception as e:
        raise HTTPException(status_code=404, detail=f"File not found: {str(e)}")

# File Upload
@app.post("/api/upload-file")
async def upload_file(
    file: UploadFile = File(...),
    field_name: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    """Upload file to MongoDB GridFS for persistent storage"""
    try:
        file_id = await save_file_to_gridfs(file, current_user['_id'], field_name)
        
        storage_type = "local" if USE_MOCK_DB else "mongodb"
        
        return JSONResponse(
            status_code=200,
            content={
                "message": "File uploaded successfully",
                "file_id": file_id,
                "field_name": field_name,
                "storage": storage_type,
                "filename": file.filename
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File upload failed: {str(e)}")

# File Download
@app.get("/api/download-file/{file_id}")
@app.get("/api/download/{file_id}")
async def download_file(
    file_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Download file from MongoDB GridFS"""
    try:
        if USE_MOCK_DB:
            # Local file
            file_path = await get_file_from_gridfs(file_id)
            return StreamingResponse(
                open(file_path, "rb"),
                media_type="application/octet-stream",
                headers={"Content-Disposition": f"attachment; filename={file_path.name}"}
            )
        else:
            # GridFS file
            from bson import ObjectId
            grid_out = await get_file_from_gridfs(file_id)
            
            # Stream file from GridFS
            async def file_stream():
                while True:
                    chunk = await grid_out.read(1024 * 64)  # 64KB chunks
                    if not chunk:
                        break
                    yield chunk
            
            metadata = grid_out.metadata or {}
            filename = grid_out.filename or f"file_{file_id}"
            content_type = metadata.get("content_type", "application/octet-stream")
            
            return StreamingResponse(
                file_stream(),
                media_type=content_type,
                headers={"Content-Disposition": f"attachment; filename={filename}"}
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File download failed: {str(e)}")

# Scholar Endpoints
@app.post("/api/scholar/application")
async def submit_application(
    application: ApplicationCreate,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    try:
        payment_status_raw = (application.paymentStatus or "").strip().lower()
        has_payment_proof = bool((application.transactionId or "").strip()) or bool((application.paymentDate or "").strip())
        payment_status = "Paid" if payment_status_raw == "paid" or has_payment_proof else "Pending"
        if payment_status != "Paid":
            raise HTTPException(status_code=400, detail="Application fee payment is pending. Please pay before submission")

        if application.paymentAmount is None or float(application.paymentAmount) <= 0:
            raise HTTPException(status_code=400, detail="Valid payment amount is required")

        payment_date = application.paymentDate or datetime.utcnow().isoformat()

        # Keep scrutiny routing reliable even if the scholar profile department is missing.
        application_department = (current_user.get("department") or "").strip()
        if not application_department:
            application_department = (application.ug_details.branch_department or "").strip()
        if not application_department:
            application_department = "Not Specified"

        selected_institute = (application.personal_details.institution or "").strip() or "PTU"

        # Check if user already has a submitted application
        existing = await applications_collection.find_one({
            "$and": [
                build_scholar_access_filter(current_user),
                {"status": {"$in": ACTIVE_APPLICATION_STATUSES}},
            ]
        })
        
        if existing:
            # Persist latest form values into the active application to support cumulative edits.
            await applications_collection.update_one(
                {"_id": existing["_id"]},
                {
                    "$set": {
                        "department": application_department,
                        "institute": selected_institute,
                        "personal_details": application.personal_details.dict(),
                        "ug_details": application.ug_details.dict(),
                        "pg_details": application.pg_details.dict() if application.pg_details else None,
                        "entrance_exam": application.entrance_exam.dict(),
                        "research_info": application.research_info.dict(),
                        "work_experience": application.work_experience.dict() if application.work_experience else None,
                        "uploaded_files": application.uploaded_files or {},
                        "paymentStatus": payment_status,
                        "paymentDate": payment_date,
                        "paymentAmount": float(application.paymentAmount),
                        "paymentMethod": (application.paymentMethod or "").strip() or None,
                        "transactionId": (application.transactionId or "").strip() or None,
                        "updated_at": datetime.utcnow(),
                    }
                },
            )

            return JSONResponse(
                status_code=200,
                content={
                    "message": "Application updated successfully",
                    "registration_id": existing.get("registration_id") or existing.get("_id") or "N/A",
                    "application_id": existing.get("_id") or "N/A",
                    "status": existing.get("status") or ApplicationStatus.SUBMITTED.value,
                },
            )
        
        # Create application
        app_id = f"APP{datetime.now().strftime('%Y%m%d%H%M%S')}"
        registration_id = f"PHD{datetime.now().strftime('%Y%m%d%H%M%S')}"
        
        app_doc = {
            "_id": app_id,
            "scholar_id": current_user["_id"],
            "scholar_email": current_user["email"],
            "scholar_name": current_user["full_name"],
            "department": application_department,
            "institute": selected_institute,
            "registration_id": registration_id,
            "status": ApplicationStatus.SUBMITTED.value,
            "personal_details": application.personal_details.dict(),
            "ug_details": application.ug_details.dict(),
            "pg_details": application.pg_details.dict() if application.pg_details else None,
            "entrance_exam": application.entrance_exam.dict(),
            "research_info": application.research_info.dict(),
            "work_experience": application.work_experience.dict() if application.work_experience else None,
            "uploaded_files": application.uploaded_files or {},
            "paymentStatus": payment_status,
            "paymentDate": payment_date,
            "paymentAmount": float(application.paymentAmount),
            "paymentMethod": (application.paymentMethod or "").strip() or None,
            "transactionId": (application.transactionId or "").strip() or None,
            "paymentReceiptPath": None,
            "examScore": None,
            "examStatus": "Pending",
            "attendanceStatus": None,
            "entranceMarks": None,
            "qualified": False,
            "entranceRank": None,
            "candidateStatus": None,
            "pgMarks": None,
            "interviewMarks": None,
            "interviewEvaluatedBy": None,
            "interviewEvaluatedAt": None,
            "finalScore": None,
            "finalRank": None,
            "evaluatedBy": None,
            "entranceEvaluationDepartment": application_department,
            "entranceExamDate": DEFAULT_EXAM_DATE,
            "entranceExamTime": DEFAULT_EXAM_TIME,
            "entranceExamReportingTime": DEFAULT_REPORTING_TIME,
            "entranceExamDuration": DEFAULT_EXAM_DURATION,
            "entranceExamCentre": DEFAULT_EXAM_CENTRE,
            "hallTicketGenerated": False,
            "hallTicketNumber": None,
            "hallTicketPath": None,
            "entranceApplicationStatus": "Pending",
            "entranceFormSubmitted": False,
            "preferredLanguage": None,
            "entranceApplicationSubmittedAt": None,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "reviews": [],
            "final_decision": None,
            "interviewDate": None,
            "interviewMode": None,
            "interviewPanel": None,
            "interviewRemarks": None,
            "dean_review": None,
            "offerLetterGenerated": False,
            "offerLetterPath": None,
            "offerLetterGeneratedAt": None,
            "admissionDeadlineDate": None,
            "admissionDecision": None,
            "admissionRespondedAt": None,
            "registrationNumber": None,
            "joiningLetterGenerated": False,
            "joiningLetterPath": None,
            "joiningLetterGeneratedAt": None,
            "joiningDate": None,
            "scrutinyVerificationReceiptPath": None,
            "scrutinyVerificationReceiptGeneratedAt": None,
        }
        
        await applications_collection.insert_one(app_doc)

        receipt_path = UPLOAD_DIR / current_user["_id"] / f"payment_receipt_{registration_id}.pdf"
        receipt_generated = False
        try:
            await build_payment_receipt_pdf(
                {
                    "candidateName": application.personal_details.full_name,
                    "registrationId": registration_id,
                    "department": application_department,
                    "modeOfStudy": application.personal_details.mode_of_study,
                    "category": application.personal_details.category,
                    "email": application.personal_details.email,
                    "mobile": application.personal_details.mobile,
                    "paymentDate": payment_date,
                    "paymentMethod": app_doc.get("paymentMethod"),
                    "transactionId": app_doc.get("transactionId"),
                    "amount": float(application.paymentAmount),
                },
                receipt_path,
            )

            await applications_collection.update_one(
                {"_id": app_id},
                {
                    "$set": {
                        "paymentReceiptPath": str(receipt_path).replace("\\", "/"),
                        "paymentReceiptTemplateVersion": 4,
                        "updated_at": datetime.utcnow(),
                    }
                }
            )
            receipt_generated = True
        except Exception as exc:
            print(f"⚠️ Payment receipt PDF generation failed for {registration_id}: {exc}")

        payment_receipt_email_sent = False
        candidate_email = await resolve_application_recipient_email(app_doc, current_user=current_user)
        try:
            if candidate_email:
                await send_payment_receipt_email(
                    to_email=candidate_email,
                    candidate_name=application.personal_details.full_name,
                    registration_id=registration_id,
                    amount=float(application.paymentAmount),
                    payment_date=payment_date,
                    payment_method=app_doc.get("paymentMethod"),
                    transaction_id=app_doc.get("transactionId"),
                    receipt_path=receipt_path if receipt_generated else None,
                )
                payment_receipt_email_sent = True
        except Exception as exc:
            print(f"⚠️ Payment receipt email failed for {registration_id}: {exc}")

        if payment_receipt_email_sent:
            await applications_collection.update_one(
                {"_id": app_id},
                {
                    "$set": {
                        "paymentReceiptEmailSentAt": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                }
            )
        
        print(f"✅ Application submitted successfully!")
        print(f"   Scholar: {current_user['full_name']} ({current_user['email']})")
        print(f"   Registration ID: {registration_id}")
        print(f"   Application ID: {app_id}")
        print(f"   Status: {app_doc['status']}")
        
        # Create notification
        await notifications_collection.insert_one({
            "user_id": current_user["_id"],
            "message": f"Application {registration_id} submitted successfully",
            "type": "application_submitted",
            "created_at": datetime.utcnow(),
            "read": False,
            "payment_receipt_email_sent": payment_receipt_email_sent,
            "payment_receipt_generated": receipt_generated,
        })
        
        return JSONResponse(
            status_code=201,
            content={
                "message": "Application submitted successfully",
                "registration_id": registration_id,
                "application_id": app_id,
                "status": app_doc["status"]
            }
        )
    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Application submission failed: {str(e)}")

@app.get("/api/scholar/my-applications")
async def get_my_applications(
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    applications = []
    cursor = applications_collection.find(build_scholar_access_filter(current_user))
    async for doc in cursor:
        doc["id"] = doc["_id"]
        doc = serialize_document(doc)
        applications.append(doc)
    
    print(f"Returning {len(applications)} applications for scholar {current_user['_id']}")
    return {"applications": applications, "total": len(applications)}

@app.get("/api/scholar/application/{app_id}/workflow-status")
async def get_application_workflow_status(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    response = {
        "applicationId": app_id,
        "registrationId": app.get("registration_id"),
        "status": app.get("status"),
        "paymentStatus": app.get("paymentStatus", "Pending"),
        "paymentDate": app.get("paymentDate"),
        "paymentAmount": app.get("paymentAmount", DEFAULT_APPLICATION_FEE),
        "paymentMethod": app.get("paymentMethod"),
        "transactionId": app.get("transactionId"),
        "paymentReceiptPath": app.get("paymentReceiptPath"),
        "entranceApplicationStatus": app.get("entranceApplicationStatus", "Pending"),
        "entranceFormSubmitted": bool(app.get("entranceFormSubmitted")),
        "entranceAppliedAt": app.get("entranceAppliedAt"),
        "scrutinyStatus": app.get("scrutinyStatus") or app.get("scrutiny_status") or ((app.get("scrutiny") or {}).get("status") if app.get("scrutiny") else None),
        "scrutinyVerificationReceiptPath": app.get("scrutinyVerificationReceiptPath"),
        "scrutinyVerificationReceiptGeneratedAt": app.get("scrutinyVerificationReceiptGeneratedAt"),
        "scrutinyVerificationReceiptAvailable": bool(app.get("scrutinyVerificationReceiptPath")),
        "examScore": app.get("examScore"),
        "examStatus": app.get("examStatus", "Pending"),
        "attendanceStatus": app.get("attendanceStatus"),
        "entranceMarks": app.get("entranceMarks"),
        "qualified": bool(app.get("qualified")),
        "entranceRank": app.get("entranceRank"),
        "candidateStatus": app.get("candidateStatus"),
        "pgMarks": app.get("pgMarks"),
        "interviewMarks": app.get("interviewMarks"),
        "finalScore": app.get("finalScore"),
        "finalRank": app.get("finalRank"),
        "offerLetterGenerated": bool(app.get("offerLetterGenerated")),
        "offerLetterPath": app.get("offerLetterPath"),
        "admissionDeadlineDate": app.get("admissionDeadlineDate"),
        "admissionDecision": app.get("admissionDecision"),
        "admissionRespondedAt": app.get("admissionRespondedAt"),
        "registrationNumber": app.get("registrationNumber"),
        "joiningLetterGenerated": bool(app.get("joiningLetterGenerated")),
        "joiningLetterPath": app.get("joiningLetterPath"),
        "joiningDate": app.get("joiningDate"),
        "entranceExamDate": get_effective_exam_schedule(app)["examDate"],
        "entranceExamTime": get_effective_exam_schedule(app)["examTime"],
        "entranceExamReportingTime": get_effective_exam_schedule(app)["reportingTime"],
        "entranceExamDuration": get_effective_exam_schedule(app)["examDuration"],
        "entranceExamCentre": get_effective_exam_schedule(app)["examCentre"],
        "hallTicketAvailable": bool(app.get("hallTicketPath")),
        "hallTicketGenerated": bool(app.get("hallTicketGenerated")),
        "hallTicketNumber": app.get("hallTicketNumber") or derive_hall_ticket_number(app),
        "hallTicketPath": app.get("hallTicketPath"),
        "canProceedToNextStages": can_proceed_in_workflow(app),
        "entranceExamPolicy": get_ptu_entrance_exam_policy(),
    }
    return serialize_document(response)

@app.get("/api/entrance-exam/policy")
async def get_entrance_exam_policy(
    current_user: dict = Depends(get_current_user)
):
    return {
        "examCentre": DEFAULT_EXAM_CENTRE,
        "examDate": DEFAULT_EXAM_DATE,
        "examTime": DEFAULT_EXAM_TIME,
        "reportingTime": DEFAULT_REPORTING_TIME,
        "examDuration": DEFAULT_EXAM_DURATION,
        "policy": get_ptu_entrance_exam_policy(),
    }

@app.get("/api/scholar/hall-ticket/{app_id}")
async def download_or_generate_hall_ticket(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    enforce_hall_ticket_eligibility(app)

    hall_ticket_path = app.get("hallTicketPath")
    hall_ticket_file = Path(hall_ticket_path) if hall_ticket_path else (UPLOAD_DIR / current_user["_id"] / "hall_ticket.pdf")
    schedule = get_effective_exam_schedule(app)
    should_generate = (
        not hall_ticket_file.exists()
        or not app.get("hallTicketGenerated")
        or app.get("hallTicketTemplateVersion") != 2
        or resolve_exam_value(app.get("entranceExamDate"), DEFAULT_EXAM_DATE) != schedule["examDate"]
        or resolve_exam_value(app.get("entranceExamTime"), DEFAULT_EXAM_TIME) != schedule["examTime"]
        or resolve_exam_value(app.get("entranceExamReportingTime"), DEFAULT_REPORTING_TIME) != schedule["reportingTime"]
        or resolve_exam_value(app.get("entranceExamDuration"), DEFAULT_EXAM_DURATION) != schedule["examDuration"]
    )
    hall_ticket_number = app.get("hallTicketNumber") or derive_hall_ticket_number(app)

    if should_generate:
        if not app.get("hallTicketNumber"):
            await applications_collection.update_one(
                {"_id": app_id},
                {
                    "$set": {
                        "hallTicketNumber": hall_ticket_number,
                        "updated_at": datetime.utcnow(),
                    }
                }
            )
            app["hallTicketNumber"] = hall_ticket_number

        await build_hall_ticket_pdf(app, hall_ticket_file)

        await applications_collection.update_one(
            {"_id": app_id},
            {
                "$set": {
                    "hallTicketGenerated": True,
                    "hallTicketTemplateVersion": 2,
                    "hallTicketNumber": hall_ticket_number,
                    "hallTicketPath": str(hall_ticket_file).replace("\\", "/"),
                    "examStatus": "Scheduled",
                    "hallTicketGeneratedAt": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            }
        )

        email_sent = False
        try:
            candidate_email = await resolve_application_recipient_email(app, current_user=current_user)
            if candidate_email:
                await send_hall_ticket_email(candidate_email, hall_ticket_file)
                email_sent = True
        except Exception as exc:
            print(f"⚠️ Hall ticket generated but email sending failed for {app_id}: {exc}")

        await notifications_collection.insert_one({
            "user_id": app["scholar_id"],
            "message": "Your hall ticket has been generated. Please download and bring it to the exam.",
            "type": "hall_ticket_generated",
            "created_at": datetime.utcnow(),
            "read": False,
            "email_sent": email_sent,
        })

    return FileResponse(
        path=str(hall_ticket_file),
        media_type="application/pdf",
        filename="hall_ticket.pdf",
    )

@app.get("/api/scholar/payment-receipt/{app_id}")
async def download_or_generate_payment_receipt(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if not is_payment_completed(app):
        raise HTTPException(status_code=400, detail="Payment is not completed")

    receipt_path = app.get("paymentReceiptPath")
    default_receipt_file = UPLOAD_DIR / current_user["_id"] / f"payment_receipt_{app.get('registration_id') or app_id}.pdf"
    receipt_file = Path(receipt_path) if receipt_path else default_receipt_file

    receipt_template_version = 4
    receipt_notification_required = not bool(app.get("paymentReceiptGeneratedAt"))

    # Always regenerate so template/logo updates are reflected for existing applications.
    should_generate = True
    if should_generate:
        personal = app.get("personal_details") or {}
        await build_payment_receipt_pdf(
            {
                "candidateName": personal.get("full_name") or app.get("scholar_name") or "N/A",
                "registrationId": app.get("registration_id") or app_id,
                "department": app.get("department") or ((app.get("ug_details") or {}).get("branch_department")) or "N/A",
                "modeOfStudy": personal.get("mode_of_study") or "N/A",
                "category": personal.get("category") or "N/A",
                "email": personal.get("email") or app.get("scholar_email") or "N/A",
                "mobile": personal.get("mobile") or "N/A",
                "paymentDate": app.get("paymentDate") or datetime.utcnow().isoformat(),
                "paymentMethod": app.get("paymentMethod") or "N/A",
                "transactionId": app.get("transactionId") or "N/A",
                "amount": float(app.get("paymentAmount") or DEFAULT_APPLICATION_FEE),
            },
            receipt_file,
        )

        await applications_collection.update_one(
            {"_id": app_id},
            {
                "$set": {
                    "paymentReceiptPath": str(receipt_file).replace("\\", "/"),
                    "paymentReceiptTemplateVersion": receipt_template_version,
                    "paymentReceiptGeneratedAt": app.get("paymentReceiptGeneratedAt") or datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            }
        )

        if receipt_notification_required:
            await notifications_collection.insert_one({
                "user_id": app["scholar_id"],
                "message": "Your fee receipt has been generated.",
                "type": "payment_receipt_generated",
                "created_at": datetime.utcnow(),
                "read": False,
            })

        receipt_email_sent = False
        try:
            candidate_email = await resolve_application_recipient_email(app, current_user=current_user)
            if candidate_email:
                await send_payment_receipt_email(
                    to_email=candidate_email,
                    candidate_name=personal.get("full_name") or app.get("scholar_name") or "Candidate",
                    registration_id=app.get("registration_id") or app_id,
                    amount=float(app.get("paymentAmount") or DEFAULT_APPLICATION_FEE),
                    payment_date=app.get("paymentDate") or datetime.utcnow().isoformat(),
                    payment_method=app.get("paymentMethod") or "N/A",
                    transaction_id=app.get("transactionId") or "N/A",
                    receipt_path=receipt_file,
                )
                receipt_email_sent = True
        except Exception as exc:
            print(f"⚠️ Payment receipt generated but email sending failed for {app_id}: {exc}")

        if receipt_email_sent:
            await applications_collection.update_one(
                {"_id": app_id},
                {
                    "$set": {
                        "paymentReceiptEmailSentAt": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                }
            )

    download_name = f"payment_receipt_{app.get('registration_id') or app_id}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    return FileResponse(
        path=str(receipt_file),
        media_type="application/pdf",
        filename=download_name,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@app.post("/api/scholar/final-fee/pay/{app_id}")
async def pay_final_fee(
    app_id: str,
    payload: FinalFeePaymentRequest,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    amount = float(app.get("finalFeeAmount") or get_default_final_fee_amount(app))
    payment_method = (payload.payment_method or "").strip() or "UPI / Card / Net Banking"
    transaction_id = (payload.transaction_id or "").strip() or f"FTXN{datetime.now().strftime('%Y%m%d%H%M%S')}{secrets.randbelow(9000) + 1000}"
    payment_date = datetime.now(timezone.utc).isoformat()

    registration_ref = app.get("registrationNumber") or app.get("registration_id") or app_id
    receipt_file = UPLOAD_DIR / current_user["_id"] / f"final_fee_receipt_{registration_ref}.pdf"

    personal = app.get("personal_details") or {}
    await build_payment_receipt_pdf(
        {
            "candidateName": personal.get("full_name") or app.get("scholar_name") or "N/A",
            "registrationId": registration_ref,
            "department": app.get("department") or ((app.get("ug_details") or {}).get("branch_department")) or "N/A",
            "modeOfStudy": personal.get("mode_of_study") or "N/A",
            "category": personal.get("category") or "N/A",
            "email": personal.get("email") or app.get("scholar_email") or "N/A",
            "mobile": personal.get("mobile") or "N/A",
            "paymentDate": payment_date,
            "paymentMethod": payment_method,
            "transactionId": transaction_id,
            "amount": amount,
            "paymentType": "Admission Fee",
        },
        receipt_file,
    )

    await applications_collection.update_one(
        {"_id": app_id},
        {
            "$set": {
                "finalFeeAmount": amount,
                "finalFeeStatus": "Paid",
                "finalFeePaymentDate": payment_date,
                "finalFeePaymentMethod": payment_method,
                "finalFeeTransactionId": transaction_id,
                "finalFeeReceiptPath": str(receipt_file).replace("\\", "/"),
                "finalFeeReceiptGeneratedAt": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        }
    )

    receipt_email_sent = False
    try:
        candidate_email = await resolve_application_recipient_email(app, current_user=current_user)
        if candidate_email:
            await send_payment_receipt_email(
                to_email=candidate_email,
                candidate_name=personal.get("full_name") or app.get("scholar_name") or "Candidate",
                registration_id=str(registration_ref),
                amount=amount,
                payment_date=payment_date,
                payment_method=payment_method,
                transaction_id=transaction_id,
                payment_label="Admission Fee",
                receipt_path=receipt_file,
            )
            receipt_email_sent = True
    except Exception as exc:
        print(f"⚠️ Final fee receipt email failed for {app_id}: {exc}")

    if receipt_email_sent:
        await applications_collection.update_one(
            {"_id": app_id},
            {
                "$set": {
                    "finalFeeReceiptEmailSentAt": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            }
        )

    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": "Your final admission fee receipt has been generated and emailed.",
        "type": "final_fee_receipt_generated",
        "created_at": datetime.utcnow(),
        "read": False,
        "email_sent": receipt_email_sent,
    })

    return {
        "message": "Final fee payment completed",
        "feeAmount": amount,
        "feeStatus": "Paid",
        "paymentDate": payment_date,
        "paymentMethod": payment_method,
        "transactionId": transaction_id,
        "receiptPath": str(receipt_file).replace("\\", "/"),
        "emailSent": receipt_email_sent,
    }

@app.get("/api/scholar/final-fee-receipt/{app_id}")
async def download_or_generate_final_fee_receipt(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    seat_status = str(
        app.get("seatAllocationStatus")
        or app.get("seat_status")
        or app.get("seatStatus")
        or ""
    ).strip().lower()
    if seat_status not in {SEAT_ALLOCATED_LABEL.lower(), "allocated"}:
        raise HTTPException(status_code=400, detail="Final fee receipt is available only after seat allocation")

    if not is_final_fee_paid(app):
        raise HTTPException(status_code=400, detail="Final fee is not paid")

    registration_ref = app.get("registrationNumber") or app.get("registration_id") or app_id
    receipt_path = app.get("finalFeeReceiptPath")
    receipt_file = Path(receipt_path) if receipt_path else (UPLOAD_DIR / current_user["_id"] / f"final_fee_receipt_{registration_ref}.pdf")

    if not receipt_file.exists():
        personal = app.get("personal_details") or {}
        await build_payment_receipt_pdf(
            {
                "candidateName": personal.get("full_name") or app.get("scholar_name") or "N/A",
                "registrationId": registration_ref,
                "department": app.get("department") or ((app.get("ug_details") or {}).get("branch_department")) or "N/A",
                "modeOfStudy": personal.get("mode_of_study") or "N/A",
                "category": personal.get("category") or "N/A",
                "email": personal.get("email") or app.get("scholar_email") or "N/A",
                "mobile": personal.get("mobile") or "N/A",
                "paymentDate": app.get("finalFeePaymentDate") or datetime.now(timezone.utc).isoformat(),
                "paymentMethod": app.get("finalFeePaymentMethod") or "UPI / Card / Net Banking",
                "transactionId": app.get("finalFeeTransactionId") or f"FTXN{datetime.now().strftime('%Y%m%d%H%M%S')}{secrets.randbelow(9000) + 1000}",
                "amount": float(app.get("finalFeeAmount") or get_default_final_fee_amount(app)),
                "paymentType": "Admission Fee",
            },
            receipt_file,
        )

        await applications_collection.update_one(
            {"_id": app_id},
            {
                "$set": {
                    "finalFeeReceiptPath": str(receipt_file).replace("\\", "/"),
                    "finalFeeReceiptGeneratedAt": app.get("finalFeeReceiptGeneratedAt") or datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                }
            }
        )

    download_name = f"final_fee_receipt_{registration_ref}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.pdf"
    return FileResponse(
        path=str(receipt_file),
        media_type="application/pdf",
        filename=download_name,
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@app.get("/api/scholar/scrutiny-verification-receipt/{app_id}")
async def download_or_generate_scrutiny_verification_receipt(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if not is_scrutiny_approved(app):
        raise HTTPException(status_code=400, detail="Scrutiny must be approved before downloading this receipt")

    receipt_path = app.get("scrutinyVerificationReceiptPath")
    default_receipt_file = UPLOAD_DIR / current_user["_id"] / f"scrutiny_verification_receipt_{app.get('registration_id') or app_id}.pdf"
    receipt_file = Path(receipt_path) if receipt_path else default_receipt_file

    should_generate = not receipt_file.exists()
    if should_generate:
        app_for_receipt = dict(app)
        scrutiny_status = str(
            app.get("scrutiny_status")
            or app.get("scrutinyStatus")
            or (app.get("scrutiny") or {}).get("status")
            or "approved"
        ).strip().lower()
        app_for_receipt.update({
            "scrutiny_status": scrutiny_status,
            "scrutinyStatus": app.get("scrutinyStatus") or scrutiny_status.title(),
        })
        await build_scrutiny_verification_receipt_pdf(app_for_receipt, receipt_file)

    now = datetime.utcnow()
    await applications_collection.update_one(
        {"_id": app_id},
        {
            "$set": {
                "scrutinyVerificationReceiptPath": str(receipt_file).replace("\\", "/"),
                "scrutinyVerificationReceiptGeneratedAt": app.get("scrutinyVerificationReceiptGeneratedAt") or now,
                "updated_at": now,
            }
        }
    )

    return FileResponse(
        path=str(receipt_file),
        media_type="application/pdf",
        filename=f"scrutiny_verification_receipt_{app.get('registration_id') or app_id}.pdf",
        headers={
            "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )

@app.get("/api/scholar/offer-letter/{app_id}")
async def download_or_generate_offer_letter(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    seat_status = str(
        app.get("seatAllocationStatus")
        or app.get("seat_status")
        or app.get("seatStatus")
        or ""
    ).strip().lower()
    if seat_status not in {SEAT_ALLOCATED_LABEL.lower(), "allocated"}:
        raise HTTPException(status_code=400, detail="Offer letter is available only after seat allocation")

    status_value = str(app.get("status") or "").strip().lower()
    if status_value not in {
        ApplicationStatus.FINAL_APPROVED.value,
        ApplicationStatus.ACCEPTED.value,
        ApplicationStatus.ADMISSION_CONFIRMED.value,
    }:
        raise HTTPException(status_code=400, detail="Offer letter is available only after Research Director approval")

    registration_id = app.get("registration_id") or app_id
    deadline_date = app.get("admissionDeadlineDate") or (datetime.utcnow() + timedelta(days=OFFER_LETTER_DEADLINE_DAYS)).date().isoformat()
    offer_path = app.get("offerLetterPath")
    default_offer_file = UPLOAD_DIR / current_user["_id"] / "admission_letters" / f"offer_letter_{registration_id}.pdf"
    offer_file = Path(offer_path) if offer_path else default_offer_file

    should_generate = (
        not app.get("offerLetterGenerated")
        or not offer_file.exists()
    )
    if should_generate:
        await generate_offer_letter_pdf(app, offer_file, deadline_date)
        await applications_collection.update_one(
            {"_id": app_id},
            {
                "$set": {
                    "offerLetterGenerated": True,
                    "offerLetterPath": str(offer_file).replace("\\", "/"),
                    "offerLetterGeneratedAt": datetime.utcnow(),
                    "admissionDeadlineDate": deadline_date,
                    "updated_at": datetime.utcnow(),
                }
            }
        )

    return FileResponse(
        path=str(offer_file),
        media_type="application/pdf",
        filename=f"offer_letter_{registration_id}.pdf",
    )

@app.post("/api/scholar/admission-decision/{app_id}")
async def submit_admission_decision(
    app_id: str,
    payload: AdmissionDecisionRequest,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    decision = str(payload.decision or "").strip().lower()
    if decision not in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="Invalid decision")

    app_status = str(app.get("status") or "").strip().lower()
    if app_status != ApplicationStatus.FINAL_APPROVED.value:
        raise HTTPException(status_code=400, detail="Admission response is allowed only after Research Director approval")

    if str(app.get("admissionDecision") or "").strip().lower() in {"accept", "reject"}:
        raise HTTPException(status_code=400, detail="Admission decision already submitted")

    if not app.get("offerLetterGenerated"):
        raise HTTPException(status_code=400, detail="Offer letter must be generated before admission response")

    seat_status = str(
        app.get("seatAllocationStatus")
        or app.get("seat_status")
        or app.get("seatStatus")
        or ""
    ).strip().lower()
    if seat_status not in {SEAT_ALLOCATED_LABEL.lower(), "allocated"}:
        raise HTTPException(status_code=400, detail="Admission response is allowed only after seat allocation")

    now = datetime.utcnow()
    update_fields = {
        "admissionDecision": decision,
        "admissionRespondedAt": now,
        "updated_at": now,
    }

    notification_message = ""
    notification_type = "admission_response"
    joining_letter_email_sent = False

    if decision == "reject":
        update_fields["status"] = ApplicationStatus.REJECTED.value
        update_fields["seatAllocationStatus"] = "Seat Lapsed"
        update_fields["seatLapsedAt"] = now
        update_fields["registrationNumber"] = None
        notification_message = f"You have rejected the admission offer for application {app.get('registration_id') or app_id}."
        notification_type = "admission_rejected"

        promoted_candidate = await promote_waitlisted_candidate_for_vacancy(app)
        if promoted_candidate:
            notification_message = (
                f"You have rejected the admission offer for application {app.get('registration_id') or app_id}. "
                f"Seat has lapsed and waitlisted candidate {promoted_candidate.get('registration_id')} has been promoted."
            )
    else:
        update_fields["status"] = ApplicationStatus.ACCEPTED.value

        registration_number = app.get("registrationNumber")
        admission_status = str(
            app.get("admissionDecision")
            or decision
            or ""
        ).strip().lower()
        if (
            not registration_number
            and seat_status in {SEAT_ALLOCATED_LABEL.lower(), "allocated"}
            and admission_status == "accept"
        ):
            registration_number = await generate_unique_registration_number(app)

        joining_date = now.date().isoformat()
        joining_file = UPLOAD_DIR / current_user["_id"] / "admission_letters" / f"joining_letter_{registration_number}.pdf"

        joining_context = dict(app)
        joining_context["registrationNumber"] = registration_number
        joining_context["joiningDate"] = joining_date

        await generate_joining_letter_pdf(joining_context, joining_file)

        update_fields.update({
            "status": ApplicationStatus.ADMISSION_CONFIRMED.value,
            "registrationNumber": registration_number,
            "joiningDate": joining_date,
            "joiningLetterGenerated": True,
            "joiningLetterPath": str(joining_file).replace("\\", "/"),
            "joiningLetterGeneratedAt": now,
        })

        candidate_email = await resolve_application_recipient_email(app, current_user=current_user)
        if candidate_email:
            try:
                await send_joining_letter_email(candidate_email, joining_file, registration_number)
                joining_letter_email_sent = True
            except Exception as exc:
                print(f"⚠️ Joining letter generated but email sending failed for {app_id}: {exc}")

        notification_message = (
            f"Admission confirmed for application {app.get('registration_id') or app_id}. "
            f"Your registration number is {registration_number}."
        )
        notification_type = "admission_confirmed"

    if (
        update_fields.get("registrationNumber")
        and (
            seat_status not in {SEAT_ALLOCATED_LABEL.lower(), "allocated"}
            or decision != "accept"
        )
    ):
        update_fields["registrationNumber"] = None

    await applications_collection.update_one(
        {"_id": app_id},
        {"$set": update_fields}
    )

    await notifications_collection.insert_one({
        "user_id": current_user["_id"],
        "message": notification_message,
        "type": notification_type,
        "created_at": datetime.utcnow(),
        "read": False,
        "joining_letter_email_sent": joining_letter_email_sent,
    })

    return {
        "message": "Admission response recorded successfully",
        "status": update_fields.get("status"),
        "registrationNumber": update_fields.get("registrationNumber"),
        "offerLetterGenerated": bool(app.get("offerLetterGenerated")),
        "joiningLetterGenerated": bool(update_fields.get("joiningLetterGenerated")),
    }

@app.get("/api/scholar/joining-letter/{app_id}")
async def download_or_generate_joining_letter(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=app_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    seat_status = str(
        app.get("seatAllocationStatus")
        or app.get("seat_status")
        or app.get("seatStatus")
        or ""
    ).strip().lower()
    if seat_status not in {SEAT_ALLOCATED_LABEL.lower(), "allocated"}:
        raise HTTPException(status_code=400, detail="Joining letter is available only after seat allocation")

    if str(app.get("status") or "").strip().lower() != ApplicationStatus.ADMISSION_CONFIRMED.value:
        raise HTTPException(status_code=400, detail="Joining letter is available only after admission confirmation")

    registration_number = app.get("registrationNumber")
    if not registration_number:
        registration_number = await generate_unique_registration_number(app)
        await applications_collection.update_one(
            {"_id": app_id},
            {
                "$set": {
                    "registrationNumber": registration_number,
                    "updated_at": datetime.utcnow(),
                }
            }
        )

    joining_path = app.get("joiningLetterPath")
    default_joining_file = UPLOAD_DIR / current_user["_id"] / "admission_letters" / f"joining_letter_{registration_number}.pdf"
    joining_file = Path(joining_path) if joining_path else default_joining_file

    # Always regenerate so the downloaded file reflects the latest approved template.
    await generate_joining_letter_pdf(app, joining_file)
    await applications_collection.update_one(
        {"_id": app_id},
        {
            "$set": {
                "joiningLetterGenerated": True,
                "joiningLetterPath": str(joining_file).replace("\\", "/"),
                "joiningLetterGeneratedAt": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        }
    )

    return FileResponse(
        path=str(joining_file),
        media_type="application/pdf",
        filename=f"joining_letter_{registration_number}.pdf",
    )

@app.post("/api/scholar/entrance-application")
async def submit_entrance_application(
    payload: EntranceApplicationSubmit,
    current_user: dict = Depends(require_role([UserRole.SCHOLAR]))
):
    """Scholar submits entrance application after fee payment"""
    application_id = payload.application_id
    
    app = await applications_collection.find_one(build_scholar_access_filter(current_user, app_id=application_id))
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    
    if not is_payment_completed(app):
        raise HTTPException(status_code=400, detail="Payment is not completed")

    if not is_scrutiny_approved(app):
        raise HTTPException(status_code=400, detail="Scrutiny approval is required before entrance application")

    if app.get("entranceFormSubmitted") or app.get("entranceApplicationStatus") == "Submitted":
        raise HTTPException(status_code=400, detail="Entrance application has already been submitted")
    
    if not payload.declaration:
        raise HTTPException(status_code=400, detail="Declaration must be accepted")

    if not payload.confirm_participation:
        raise HTTPException(status_code=400, detail="Participation confirmation is required")

    if not payload.mobile_number or not payload.gender or not payload.category:
        raise HTTPException(status_code=400, detail="Mobile number, gender and category are required")

    if not payload.photo_file_id or not payload.signature_file_id:
        raise HTTPException(status_code=400, detail="Photo and signature uploads are required")

    existing_uploaded_files = dict(app.get("uploaded_files") or {})
    existing_uploaded_files.update({
        "candidate_photo": payload.photo_file_id.strip(),
        "signature": payload.signature_file_id.strip(),
    })
    
    await applications_collection.update_one(
        {"_id": application_id},
        {
            "$set": {
                "entranceApplicationStatus": "Submitted",
                "entranceFormSubmitted": True,
                "entranceAppliedAt": datetime.utcnow(),
                "entranceApplicationSubmittedAt": datetime.utcnow(),
                "entranceExamDate": DEFAULT_EXAM_DATE,
                "entranceExamTime": DEFAULT_EXAM_TIME,
                "entranceExamReportingTime": DEFAULT_REPORTING_TIME,
                "entranceExamDuration": DEFAULT_EXAM_DURATION,
                "entranceExamCentre": (payload.exam_centre or DEFAULT_EXAM_CENTRE).strip(),
                "preferredLanguage": payload.preferred_language or None,
                "entranceFormData": {
                    "confirm_participation": payload.confirm_participation,
                    "mobile_number": payload.mobile_number.strip(),
                    "alternate_contact_number": (payload.alternate_contact_number or "").strip() or None,
                    "gender": payload.gender.strip(),
                    "category": payload.category.strip(),
                    "declaration": payload.declaration,
                },
                "apply_vish": payload.apply_vish,
                "uploaded_files": existing_uploaded_files,
                "status": app.get("status") or ApplicationStatus.SUBMITTED.value,
                "examStatus": "Pending",
                "updated_at": datetime.utcnow(),
            }
        }
    )

    await notifications_collection.insert_one({
        "user_id": current_user["_id"],
        "message": f"Entrance application submitted for {app.get('registration_id')}",
        "type": "entrance_application_submitted",
        "created_at": datetime.utcnow(),
        "read": False,
    })
    
    return {"message": "Entrance application submitted successfully"}

@app.post("/api/scrutiny/exam-status")
async def update_exam_status(
    payload: ExamStatusUpdateRequest,
    current_user: dict = Depends(require_role([], allow_scrutiny=True))
):
    status_value = (payload.status or "").strip().capitalize()
    if status_value not in {"Scheduled", "Completed"}:
        raise HTTPException(status_code=400, detail="Exam status must be Scheduled or Completed")

    app = await applications_collection.find_one({"_id": payload.application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    user_department = (current_user.get("department") or "").strip() or get_department_from_scrutiny_role(current_user.get("role", ""))
    app_department = (app.get("department") or "").strip() or ((app.get("ug_details") or {}).get("branch_department") or "").strip()
    if user_department and app_department and not departments_match(user_department, app_department):
        raise HTTPException(status_code=403, detail="You can only update exam status for your department")

    update_doc = {
        "examStatus": status_value,
        "updated_at": datetime.utcnow(),
    }
    if status_value == "Completed":
        update_doc["examCompletedAt"] = datetime.utcnow()
    if payload.remarks and payload.remarks.strip():
        update_doc["examStatusRemarks"] = payload.remarks.strip()

    await applications_collection.update_one({"_id": payload.application_id}, {"$set": update_doc})

    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": f"Entrance exam status updated to {status_value} for application {app.get('registration_id')}",
        "type": "exam_status_updated",
        "created_at": datetime.utcnow(),
        "read": False,
    })

    return {"message": "Exam status updated successfully", "examStatus": status_value}

@app.post("/api/scrutiny/entrance-evaluation")
async def evaluate_entrance_exam(
    payload: EntranceEvaluationRequest,
    current_user: dict = Depends(require_role([], allow_scrutiny=True))
):
    app = await applications_collection.find_one({"_id": payload.application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    user_department = (current_user.get("department") or "").strip() or get_department_from_scrutiny_role(current_user.get("role", ""))
    app_department = get_application_department(app)
    if user_department and app_department and not departments_match(user_department, app_department):
        raise HTTPException(status_code=403, detail="You can only evaluate applications from your department")

    if str(app.get("examStatus") or "").strip() != "Completed":
        raise HTTPException(status_code=400, detail="Evaluation is allowed only when exam status is Completed")

    attendance_status = str(payload.attendance_status or "").strip().capitalize()
    if attendance_status not in {"Present", "Absent"}:
        raise HTTPException(status_code=400, detail="Attendance status must be Present or Absent")

    category = ((app.get("personal_details") or {}).get("category") or "General").strip()
    marks_value = None
    qualified = False
    candidate_status = "Rejected"

    if attendance_status == "Present":
        if payload.entrance_marks is None:
            raise HTTPException(status_code=400, detail="Entrance marks are required when attendance is Present")

        marks_value = round(float(payload.entrance_marks), 2)
        if marks_value < 0 or marks_value > PTU_ENTRANCE_TOTAL_MARKS:
            raise HTTPException(status_code=400, detail=f"Entrance marks must be between 0 and {PTU_ENTRANCE_TOTAL_MARKS}")

        qualified = is_qualified_in_entrance(category, marks_value)
        if not qualified:
            candidate_status = "Rejected"
        else:
            current_status = app.get("candidateStatus")
            # Preserve advanced candidate status if they are already past entrance evaluation
            if current_status in [RECOMMENDED_FOR_INTERVIEW_LABEL, INTERVIEW_SCHEDULED_LABEL, INTERVIEW_COMPLETED_LABEL, RANKED_CANDIDATE_LABEL]:
                candidate_status = current_status
            else:
                candidate_status = "Qualified for Ranking"

    evaluation_doc = {
        "examStatus": "Completed",
        "attendanceStatus": attendance_status,
        "entranceMarks": marks_value,
        "examScore": marks_value,
        "correctAnswers": payload.correctAnswers,
        "wrongAnswers": payload.wrongAnswers,
        "qualified": qualified,
        "candidateStatus": candidate_status,
        "evaluatedBy": {
            "id": current_user.get("_id"),
            "name": current_user.get("full_name"),
            "role": current_user.get("role"),
        },
        "entranceEvaluationDepartment": app_department or user_department,
        "entranceEvaluationRemarks": (payload.remarks or "").strip() or None,
        "entranceEvaluatedAt": datetime.utcnow(),
        "updated_at": datetime.utcnow(),
    }

    # If the candidate was previously ranked but fails now, we should clear rank.
    # Otherwise, don't wipe entranceRank manually; the recalculation will handle it.
    if not qualified:
        evaluation_doc["entranceRank"] = None
        evaluation_doc["finalRank"] = None
        evaluation_doc["finalScore"] = None

    # Recalculate final score if they already have interview marks
    interview_marks = extract_numeric_marks(app.get("interviewMarks"))
    if interview_marks is not None and qualified:
        pg_marks = extract_pg_marks_for_final_score(app)
        if pg_marks is not None:
             final_score = calculate_final_score_ptu(pg_marks, marks_value, interview_marks)
             evaluation_doc["finalScore"] = final_score

    await applications_collection.update_one({"_id": payload.application_id}, {"$set": evaluation_doc})
    if app_department or user_department:
        await recalculate_department_entrance_ranks(app_department or user_department)
        if interview_marks is not None:
            await recalculate_department_final_ranks(app_department or user_department)

    refreshed_app = await applications_collection.find_one({"_id": payload.application_id})

    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": (
            f"Entrance evaluation completed for {app.get('registration_id')}. "
            f"Status: {candidate_status}."
        ),
        "type": "entrance_evaluated",
        "created_at": datetime.utcnow(),
        "read": False,
    })

    return {
        "message": "Entrance exam evaluation saved successfully",
        "applicationId": payload.application_id,
        "attendanceStatus": attendance_status,
        "entranceMarks": marks_value,
        "correctAnswers": payload.correctAnswers,
        "wrongAnswers": payload.wrongAnswers,
        "qualified": qualified,
        "candidateStatus": candidate_status,
        "entranceRank": (refreshed_app or {}).get("entranceRank"),
        "department": (refreshed_app or {}).get("department") or ((refreshed_app or {}).get("ug_details") or {}).get("branch_department"),
    }

# Faculty Endpoints
@app.get("/api/faculty/applications")
async def get_applications_for_review(
    status: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.FACULTY]))
):
    query = {
        "status": {"$in": FACULTY_VISIBLE_STATUSES}
    }

    if status and status != "all":
        if status == ApplicationStatus.FACULTY_REVIEW.value:
            query["status"] = ApplicationStatus.FACULTY_REVIEW.value
        elif status == "interview_stage":
            query["status"] = {"$in": [
                ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value,
                ApplicationStatus.INTERVIEW_SCHEDULED.value,
            ]}
        elif status in FACULTY_VISIBLE_STATUSES:
            query["status"] = status
        else:
            return {"applications": [], "total": 0}
    
    applications = []
    cursor = applications_collection.find(query).sort([("department", 1), ("created_at", -1)])
    async for doc in cursor:
        doc["id"] = doc["_id"]
        reviewed = any(r["faculty_id"] == current_user["_id"] for r in doc.get("reviews", []))
        doc["reviewed_by_me"] = reviewed
        doc = serialize_document(doc)
        applications.append(doc)
    
    return {"applications": applications, "total": len(applications)}

@app.get("/api/faculty/interview-candidates")
async def get_interview_candidates_for_faculty(
    current_user: dict = Depends(require_role([UserRole.FACULTY]))
):
    user_department = (current_user.get("department") or "").strip()
    applications = []

    cursor = applications_collection.find({
        "status": ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value,
    }).sort([
        ("department", 1),
        ("entranceRank", 1),
        ("created_at", 1),
    ])
    async for doc in cursor:
        doc_department = get_application_department(doc)
        if user_department and doc_department and not departments_match(user_department, doc_department):
            continue

        doc["id"] = doc["_id"]
        doc = serialize_document(doc)
        applications.append(doc)

    return {"applications": applications, "total": len(applications)}

@app.post("/api/faculty/interview-evaluation")
async def submit_interview_evaluation(
    payload: InterviewEvaluationRequest,
    current_user: dict = Depends(require_role([UserRole.FACULTY]))
):
    app = await applications_collection.find_one({"_id": payload.application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    user_department = (current_user.get("department") or "").strip()
    app_department = get_application_department(app)
    if user_department and app_department and not departments_match(user_department, app_department):
        raise HTTPException(status_code=403, detail="You can only evaluate interview marks for your department")

    if app.get("status") != ApplicationStatus.INTERVIEW_SCHEDULED.value:
        raise HTTPException(status_code=400, detail="Interview evaluation is allowed only after interview is scheduled")

    interview_marks = round(float(payload.interview_marks), 2)
    if interview_marks < 0 or interview_marks > PTU_INTERVIEW_TOTAL_MARKS:
        raise HTTPException(status_code=400, detail=f"Interview marks must be between 0 and {PTU_INTERVIEW_TOTAL_MARKS}")

    entrance_marks = extract_numeric_marks(app.get("entranceMarks"))
    if entrance_marks is None:
        raise HTTPException(status_code=400, detail="Entrance marks are missing for this candidate")

    pg_marks = extract_pg_marks_for_final_score(app)
    if pg_marks is None:
        raise HTTPException(status_code=400, detail="PG marks are missing for this candidate")

    final_score = calculate_final_score_ptu(pg_marks, entrance_marks, interview_marks)

    await applications_collection.update_one(
        {"_id": payload.application_id},
        {
            "$set": {
                "pgMarks": round(float(pg_marks), 2),
                "interviewMarks": interview_marks,
                "interviewEvaluatedBy": {
                    "id": current_user.get("_id"),
                    "name": current_user.get("full_name"),
                    "department": user_department,
                    "role": current_user.get("role"),
                },
                "interviewEvaluatedAt": datetime.utcnow(),
                "interviewRemarks": (payload.remarks or app.get("interviewRemarks") or "").strip() or None,
                "status": ApplicationStatus.INTERVIEW_COMPLETED.value,
                "finalScore": final_score,
                "candidateStatus": INTERVIEW_COMPLETED_LABEL,
                "updated_at": datetime.utcnow(),
            }
        }
    )

    if app_department:
        await recalculate_department_final_ranks(app_department)

    refreshed = await applications_collection.find_one({"_id": payload.application_id})

    await notifications_collection.insert_one({
        "user_id": app.get("scholar_id"),
        "message": (
            f"Interview evaluation completed for {app.get('registration_id')}. "
            f"Final score updated to {final_score}; final rank assigned department-wise."
        ),
        "type": "interview_evaluation_completed",
        "created_at": datetime.utcnow(),
        "read": False,
    })

    return {
        "message": "Interview evaluation saved successfully",
        "applicationId": payload.application_id,
        "interviewMarks": interview_marks,
        "pgMarks": round(float(pg_marks), 2),
        "entranceMarks": round(float(entrance_marks), 2),
        "finalScore": final_score,
        "finalRank": (refreshed or {}).get("finalRank"),
        "candidateStatus": (refreshed or {}).get("candidateStatus"),
    }

@app.post("/api/faculty/review")
async def submit_review(
    review: ReviewCreate,
    current_user: dict = Depends(require_role([UserRole.FACULTY]))
):
    app = await applications_collection.find_one({"_id": review.application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in FACULTY_ACTIONABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Application is not available for faculty review")

    enforce_paid_and_qualified(app)
    
    existing_review = any(r["faculty_id"] == current_user["_id"] for r in app.get("reviews", []))
    if existing_review:
        raise HTTPException(status_code=400, detail="You have already reviewed this application")

    decision_value = review.decision.value
    next_status = get_application_status_from_faculty_decision(decision_value)
    overall_score = calculate_review_overall_score(review.academic_score, review.research_score)
    
    review_doc = {
        "faculty_id": current_user["_id"],
        "faculty_name": current_user["full_name"],
        "reviewer_name": current_user["full_name"],
        "remarks": review.remarks,
        "decision": decision_value,
        "recommendation": decision_value,
        "academic_score": review.academic_score,
        "research_score": review.research_score,
        "technical_score": review.academic_score,
        "communication_score": review.research_score,
        "overall_score": overall_score,
        "created_at": datetime.utcnow(),
        "reviewed_at": datetime.utcnow()
    }
    
    await applications_collection.update_one(
        {"_id": review.application_id},
        {
            "$push": {"reviews": review_doc},
            "$set": {
                "status": next_status,
                "candidateStatus": RECOMMENDED_FOR_INTERVIEW_LABEL if next_status == ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value else "Rejected",
                "updated_at": datetime.utcnow()
            }
        }
    )

    if next_status == ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value:
        notification_message = f"Your application {app['registration_id']} has been recommended for interview."
        notification_type = "application_recommended_for_interview"
    else:
        notification_message = f"Your application {app['registration_id']} has been rejected after faculty review."
        notification_type = "application_rejected"
    
    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": notification_message,
        "type": notification_type,
        "created_at": datetime.utcnow(),
        "read": False
    })
    
    return {"message": "Review submitted successfully"}

@app.post("/api/interview/schedule")
async def schedule_interview(
    payload: InterviewScheduleRequest,
    current_user: dict = Depends(require_role([UserRole.FACULTY]))
):
    interview_mode = (payload.interviewMode or "").strip()
    if interview_mode not in ["Online", "Offline"]:
        raise HTTPException(status_code=400, detail="Interview mode must be Online or Offline")

    app = await applications_collection.find_one({"_id": payload.application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in INTERVIEW_SCHEDULABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Application is not ready for interview scheduling")

    enforce_paid_and_qualified(app)

    await applications_collection.update_one(
        {"_id": payload.application_id},
        {
            "$set": {
                "status": ApplicationStatus.INTERVIEW_SCHEDULED.value,
                "candidateStatus": INTERVIEW_SCHEDULED_LABEL,
                "interviewDate": payload.interviewDate.strip(),
                "interviewMode": interview_mode,
                "interviewPanel": payload.interviewPanel.strip(),
                "interviewRemarks": (payload.remarks or "").strip(),
                "interviewScheduledBy": current_user["_id"],
                "interviewScheduledAt": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        }
    )

    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": f"Interview scheduled for your application {app['registration_id']} on {payload.interviewDate.strip()} ({interview_mode}).",
        "type": "interview_scheduled",
        "created_at": datetime.utcnow(),
        "read": False,
    })

    return {"message": "Interview scheduled successfully"}

@app.post("/api/interview/result")
async def complete_interview(
    payload: InterviewResultRequest,
    current_user: dict = Depends(require_role([UserRole.FACULTY]))
):
    result = (payload.result or "").strip().lower()
    if result not in ["pass", "fail"]:
        raise HTTPException(status_code=400, detail="Interview result must be pass or fail")

    app = await applications_collection.find_one({"_id": payload.application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in INTERVIEW_RESULT_STATUSES:
        raise HTTPException(status_code=400, detail="Application is not in interview stage")

    enforce_paid_and_qualified(app)

    next_status = ApplicationStatus.INTERVIEW_COMPLETED.value if result == "pass" else ApplicationStatus.REJECTED.value
    interview_remarks = (payload.remarks or app.get("interviewRemarks") or "").strip()

    await applications_collection.update_one(
        {"_id": payload.application_id},
        {
            "$set": {
                "status": next_status,
                "interviewResult": result,
                "interviewRemarks": interview_remarks,
                "interviewCompletedBy": current_user["_id"],
                "interviewCompletedAt": datetime.utcnow(),
                "updated_at": datetime.utcnow(),
            }
        }
    )

    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": (
            f"Interview completed for your application {app['registration_id']}. "
            + ("You have cleared the interview and your application is moving to Dean review." if result == "pass" else "Your application has been rejected after interview.")
        ),
        "type": "interview_completed" if result == "pass" else "application_rejected",
        "created_at": datetime.utcnow(),
        "read": False,
    })

    return {"message": "Interview result submitted successfully"}

# Scrutiny Endpoints
@app.get("/api/scrutiny/applications")
async def get_applications_scrutiny(
    status: Optional[str] = None,
    current_user: dict = Depends(require_role([], allow_scrutiny=True))
):
    """Get applications for scrutiny officer - filtered by their department"""
    query = {}
    if status and status != "all":
        query["status"] = status

    # Primary filter is logged-in user's configured department.
    user_department = (current_user.get("department") or "").strip()
    if not user_department:
        # Backward-compatible fallback for scrutiny accounts with department encoded in role.
        user_department = get_department_from_scrutiny_role(current_user.get("role", ""))
    
    applications = []
    cursor = applications_collection.find(query).sort("created_at", -1)
    async for doc in cursor:
        app_department = (doc.get("department") or "").strip()
        fallback_department = ((doc.get("ug_details") or {}).get("branch_department") or "").strip()
        effective_department = app_department or fallback_department

        if user_department:
            if not effective_department or not departments_match(user_department, effective_department):
                continue

        if not app_department and fallback_department:
            # Fill response with inferred department for consistent UI display.
            doc["department"] = fallback_department

        # Normalize PG marks for scrutiny UI eligibility binding.
        pg_details = doc.get("pg_details") or {}
        doc["pgPercentage"] = pg_details.get("cgpa_percentage")

        doc["id"] = doc["_id"]
        doc = serialize_document(doc)
        applications.append(doc)
    
    return {"applications": applications, "total": len(applications)}

@app.post("/api/scrutiny/verify")
async def verify_application_scrutiny(
    payload: dict,
    current_user: dict = Depends(require_role([], allow_scrutiny=True))
):
    """Scrutiny officer verifies application documents and eligibility"""
    
    application_id = payload.get("application_id")
    documents_review_confirmed = bool(payload.get("documents_review_confirmed"))
    pg_eligibility_review_confirmed = bool(payload.get("pg_eligibility_review_confirmed"))
    remarks = payload.get("remarks", "")

    if not application_id:
        raise HTTPException(status_code=400, detail="Missing required application_id")

    if not documents_review_confirmed:
        raise HTTPException(status_code=400, detail="Please confirm documents verification before submitting scrutiny")

    if not pg_eligibility_review_confirmed:
        raise HTTPException(status_code=400, detail="Please confirm PG marks/category eligibility verification before submitting scrutiny")
    
    app = await applications_collection.find_one({"_id": application_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in SCRUTINY_ACTIONABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Application is not available for scrutiny action")

    user_department = (current_user.get("department") or "").strip()
    if not user_department:
        user_department = get_department_from_scrutiny_role(current_user.get("role", ""))

    app_department = (app.get("department") or "").strip()
    fallback_department = ((app.get("ug_details") or {}).get("branch_department") or "").strip()
    effective_app_department = app_department or fallback_department

    if user_department and effective_app_department and not departments_match(user_department, effective_app_department):
        raise HTTPException(status_code=403, detail="You can only verify applications from your department")

    if not is_payment_completed(app):
        raise HTTPException(status_code=400, detail="Cannot proceed: application fee payment is pending")

    documents_verified, missing_documents = evaluate_document_verification(app)
    (
        eligibility_verified,
        pg_marks,
        minimum_required_cgpa,
        minimum_required_percentage,
        normalized_category,
        eligibility_rule,
        percentage_equivalent,
    ) = evaluate_pg_eligibility(app)
    
    # Create scrutiny record
    eligibility_message = None
    if pg_marks is None:
        eligibility_message = "Enter CGPA or Percentage"
    elif eligibility_rule == "CGPA" and normalized_category in SCRUTINY_MIN_CGPA_BY_CATEGORY:
        eligibility_message = f"Evaluated using CGPA. Minimum CGPA required for {normalized_category.upper()} is {SCRUTINY_MIN_CGPA_BY_CATEGORY[normalized_category]}"
    elif eligibility_rule == "Percentage" and normalized_category in SCRUTINY_MIN_PERCENTAGE_BY_CATEGORY:
        eligibility_message = f"Evaluated using Percentage. Minimum Percentage required for {normalized_category.upper()} is {SCRUTINY_MIN_PERCENTAGE_BY_CATEGORY[normalized_category]}"

    scrutiny_doc = {
        "scrutiny_officer_id": current_user["_id"],
        "scrutiny_officer_name": current_user["full_name"],
        "scrutiny_officer_role": current_user["role"],
        "documents_review_confirmed": documents_review_confirmed,
        "pg_eligibility_review_confirmed": pg_eligibility_review_confirmed,
        "documents_verified": documents_verified,
        "missing_documents": missing_documents,
        "eligibility_verified": eligibility_verified,
        "minimum_required_pg_cgpa": minimum_required_cgpa,
        "minimum_required_pg_percentage": minimum_required_percentage,
        "pg_marks": pg_marks,
        "pg_percentage_equivalent": percentage_equivalent,
        "eligibility_rule": eligibility_rule,
        "category": normalized_category or "general",
        "eligibility_message": eligibility_message,
        "remarks": remarks,
        "status": "approved" if (documents_verified and eligibility_verified) else "rejected",
        "auto_verified": True,
        "scrutinized_at": datetime.utcnow()
    }
    
    # Update application with scrutiny information
    if documents_verified and eligibility_verified:
        scrutiny_status = "approved"
        scrutiny_display_status = "Approved"
        next_status = ApplicationStatus.FACULTY_REVIEW.value
        exam_status = "Pending"
    else:
        scrutiny_status = "rejected"
        scrutiny_display_status = "Rejected"
        next_status = ApplicationStatus.REJECTED.value
        exam_status = "Not Eligible"

    await applications_collection.update_one(
        {"_id": application_id},
        {
            "$set": {
                "scrutiny": scrutiny_doc,
                "scrutinyStatus": scrutiny_display_status,
                "scrutiny_status": scrutiny_status,
                "eligibility_rule": eligibility_rule,
                "examStatus": exam_status,
                "examEvaluatedAt": datetime.utcnow(),
                "status": next_status,
                "updated_at": datetime.utcnow()
            }
        }
    )

    scrutiny_receipt_generated = False
    if scrutiny_status == "approved":
        receipt_file = UPLOAD_DIR / app["scholar_id"] / f"scrutiny_verification_receipt_{app.get('registration_id') or application_id}.pdf"
        try:
            app_for_receipt = dict(app)
            app_for_receipt.update({
                "scrutiny": scrutiny_doc,
                "scrutiny_status": scrutiny_status,
                "scrutinyStatus": scrutiny_display_status,
            })
            await build_scrutiny_verification_receipt_pdf(app_for_receipt, receipt_file)
            await applications_collection.update_one(
                {"_id": application_id},
                {
                    "$set": {
                        "scrutinyVerificationReceiptPath": str(receipt_file).replace("\\", "/"),
                        "scrutinyVerificationReceiptGeneratedAt": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                }
            )
            scrutiny_receipt_generated = True
        except Exception as exc:
            print(f"⚠️ Scrutiny verification receipt generation failed for {application_id}: {exc}")
    
    # Send notification to scholar
    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": (
            f"Your application {app['registration_id']} has been scrutinized. "
            f"Documents Verified: {'Yes' if documents_verified else 'No'}, Eligibility: {'Yes' if eligibility_verified else 'No'}."
        ),
        "type": "application_scrutinized",
        "created_at": datetime.utcnow(),
        "read": False,
        "scrutiny_receipt_generated": scrutiny_receipt_generated,
    })

    if scrutiny_status == "approved":
        await notifications_collection.insert_one({
            "user_id": app["scholar_id"],
            "message": "Scrutiny verification completed. You can now proceed to Entrance Examination.",
            "type": "scrutiny_verification_completed",
            "created_at": datetime.utcnow(),
            "read": False,
            "receipt_generated": scrutiny_receipt_generated,
        })
    
    if scrutiny_status == "approved":
        outcome_message = "Scrutiny completed successfully. Application approved and moved to Faculty Review."
    else:
        outcome_message = "Scrutiny completed successfully. Application rejected based on documents/eligibility verification."

    return {
        "message": outcome_message,
        "documentsVerified": documents_verified,
        "missingDocuments": missing_documents,
        "eligible": eligibility_verified,
        "minimumRequiredPgMarks": minimum_required_cgpa if eligibility_rule == "CGPA" else minimum_required_percentage,
        "pgMarks": pg_marks,
        "eligibilityRule": eligibility_rule,
        "percentageEquivalent": percentage_equivalent,
        "scrutinyStatus": scrutiny_display_status,
        "examStatus": exam_status,
        "nextStatus": next_status,
    }

# Director Endpoints
@app.get("/api/director/applications")
async def get_all_applications_director(
    status: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.DIRECTOR]))
):
    query = {}
    if status and status != "all":
        normalized_status = str(status).strip().lower()

        if normalized_status == ApplicationStatus.FINAL_APPROVED.value:
            query["status"] = {
                "$in": [
                    ApplicationStatus.FINAL_APPROVED.value,
                    ApplicationStatus.APPROVED.value,
                    ApplicationStatus.ACCEPTED.value,
                    ApplicationStatus.ADMISSION_CONFIRMED.value,
                ]
            }
        elif normalized_status == ApplicationStatus.INTERVIEW_COMPLETED.value:
            query["status"] = {
                "$in": [
                    ApplicationStatus.INTERVIEW_COMPLETED.value,
                    ApplicationStatus.DEAN_APPROVED.value,
                    ApplicationStatus.SHORTLISTED.value,
                    ApplicationStatus.FINAL_APPROVED.value,
                    ApplicationStatus.APPROVED.value,
                    ApplicationStatus.ACCEPTED.value,
                    ApplicationStatus.ADMISSION_CONFIRMED.value,
                ]
            }
        else:
            query["status"] = normalized_status
    
    applications = []
    cursor = applications_collection.find(query).sort([("department", 1), ("created_at", -1)])
    async for doc in cursor:
        doc["id"] = doc["_id"]
        doc["review_count"] = len(doc.get("reviews", []))
        doc = serialize_document(doc)
        applications.append(doc)
    
    return {"applications": applications, "total": len(applications)}

@app.post("/api/director/shortlist/{app_id}")
async def shortlist_application(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.DIRECTOR]))
):
    app = await applications_collection.find_one({"_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in DEAN_VISIBLE_STATUSES:
        raise HTTPException(status_code=400, detail="Application is not ready for Dean review")

    enforce_paid_and_qualified(app)
    
    await applications_collection.update_one(
        {"_id": app_id},
        {
            "$set": {
                "status": "shortlisted",
                "candidateStatus": RECOMMENDED_FOR_INTERVIEW_LABEL,
                "shortlisted_by": current_user["_id"],
                "shortlisted_at": datetime.utcnow(),
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": f"Congratulations! Your application {app['registration_id']} has been shortlisted",
        "type": "application_shortlisted",
        "created_at": datetime.utcnow(),
        "read": False
    })
    
    return {"message": "Application shortlisted successfully"}

@app.get("/api/director/statistics")
async def get_statistics(
    current_user: dict = Depends(require_role([UserRole.DIRECTOR]))
):
    interview_completed_progress_statuses = [
        ApplicationStatus.INTERVIEW_COMPLETED.value,
        ApplicationStatus.DEAN_APPROVED.value,
        ApplicationStatus.SHORTLISTED.value,
        ApplicationStatus.FINAL_APPROVED.value,
        ApplicationStatus.APPROVED.value,
        ApplicationStatus.ACCEPTED.value,
        ApplicationStatus.ADMISSION_CONFIRMED.value,
    ]
    final_approved_progress_statuses = [
        ApplicationStatus.FINAL_APPROVED.value,
        ApplicationStatus.APPROVED.value,
        ApplicationStatus.ACCEPTED.value,
        ApplicationStatus.ADMISSION_CONFIRMED.value,
    ]

    total = await applications_collection.count_documents({})
    submitted = await applications_collection.count_documents({"status": "submitted"})
    under_scrutiny = await applications_collection.count_documents({"status": {"$in": [ApplicationStatus.UNDER_SCRUTINY.value, ApplicationStatus.UNDER_VERIFICATION.value]}})
    faculty_review = await applications_collection.count_documents({"status": {"$in": [ApplicationStatus.FACULTY_REVIEW.value, ApplicationStatus.REVIEWED.value]}})
    recommended_for_interview = await applications_collection.count_documents({"status": ApplicationStatus.RECOMMENDED_FOR_INTERVIEW.value})
    interview_scheduled = await applications_collection.count_documents({"status": ApplicationStatus.INTERVIEW_SCHEDULED.value})
    interview_completed = await applications_collection.count_documents({"status": {"$in": interview_completed_progress_statuses}})
    dean_approved = await applications_collection.count_documents({"status": {"$in": [ApplicationStatus.DEAN_APPROVED.value, ApplicationStatus.SHORTLISTED.value]}})
    final_approved = await applications_collection.count_documents({"status": {"$in": final_approved_progress_statuses}})
    rejected = await applications_collection.count_documents({"status": "rejected"})

    total_reviews = 0
    reviews_cursor = applications_collection.find({}, {"reviews": 1})
    async for doc in reviews_cursor:
        total_reviews += count_embedded_reviews(doc.get("reviews"))
    
    # Calculate average reviews per application
    avg_reviews = round(total_reviews / total, 2) if total > 0 else 0
    
    return {
        "total_applications": total,
        "applications_by_status": {
            "submitted": submitted,
            "under_scrutiny": under_scrutiny,
            "faculty_review": faculty_review,
            "recommended_for_interview": recommended_for_interview,
            "interview_scheduled": interview_scheduled,
            "interview_completed": interview_completed,
            "dean_approved": dean_approved,
            "final_approved": final_approved,
            "rejected": rejected
        },
        "total_reviews": total_reviews,
        "average_reviews_per_application": avg_reviews
    }

@app.get("/api/director/export-scholar-folder/{app_id}")
async def export_scholar_folder(
    app_id: str,
    current_user: dict = Depends(require_role([UserRole.DIRECTOR]))
):
    app = await applications_collection.find_one({"_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in [
        ApplicationStatus.DEAN_APPROVED.value,
        ApplicationStatus.SHORTLISTED.value,
        ApplicationStatus.APPROVED.value,
    ]:
        raise HTTPException(status_code=400, detail="Application is not ready for Research Director decision")

    registration_id = app.get("registration_id") or app_id
    scholar_name = app.get("personal_details", {}).get("full_name") or app.get("scholar_name") or app.get("scholar_id") or "unknown_scholar"
    scholar_email = app.get("personal_details", {}).get("email") or app.get("scholar_email") or "unknown_email"

    scholar_folder_name = sanitize_path_component(f"{scholar_name}_{scholar_email}")
    scholar_folder = EXPORTS_DIR / "scholars" / scholar_folder_name
    application_folder = scholar_folder / sanitize_path_component(registration_id)
    documents_folder = application_folder / "documents"

    documents_folder.mkdir(parents=True, exist_ok=True)

    serialized_app = serialize_document(dict(app))
    serialized_app["id"] = str(app.get("_id"))
    serialized_app["exported_at"] = datetime.utcnow().isoformat()
    serialized_app["exported_by"] = {
        "id": current_user.get("_id"),
        "name": current_user.get("full_name"),
        "role": current_user.get("role"),
    }

    with open(application_folder / "application_info.json", "w", encoding="utf-8") as info_file:
        json.dump(serialized_app, info_file, indent=2, ensure_ascii=True)

    uploaded_files = app.get("uploaded_files") or {}
    manifest = {
        "registration_id": registration_id,
        "scholar_name": scholar_name,
        "scholar_email": scholar_email,
        "exported_at": datetime.utcnow().isoformat(),
        "documents": [],
        "failed_documents": [],
    }

    for field_name, raw_file_ref in uploaded_files.items():
        file_id = extract_stored_file_id(raw_file_ref)
        safe_name = sanitize_path_component(field_name)

        if not file_id:
            manifest["failed_documents"].append({
                "field": field_name,
                "reason": "Missing file identifier"
            })
            continue

        try:
            saved_filename = await copy_stored_document_to_path(file_id, documents_folder / safe_name)
            manifest["documents"].append({
                "field": field_name,
                "file_id": file_id,
                "saved_as": saved_filename,
            })
        except Exception as exc:
            manifest["failed_documents"].append({
                "field": field_name,
                "file_id": file_id,
                "reason": str(exc),
            })

    with open(application_folder / "export_manifest.json", "w", encoding="utf-8") as manifest_file:
        json.dump(manifest, manifest_file, indent=2, ensure_ascii=True)

    zip_base_name = sanitize_path_component(f"{scholar_folder_name}_folder")
    zip_base_path = scholar_folder.parent / zip_base_name
    zip_file_path = Path(
        shutil.make_archive(
            str(zip_base_path),
            "zip",
            root_dir=scholar_folder.parent,
            base_dir=scholar_folder.name,
        )
    )

    download_name = f"{sanitize_path_component(registration_id)}_scholar_folder.zip"
    return FileResponse(
        path=str(zip_file_path),
        media_type="application/zip",
        filename=download_name,
    )

# Dean Endpoints
@app.get("/api/dean/shortlisted-applications")
async def get_shortlisted_applications(
    current_user: dict = Depends(require_role([UserRole.DEAN], allow_dean_variants=True))
):
    applications = []
    cursor = applications_collection.find({}).sort([("department", 1), ("created_at", -1)])
    
    async for doc in cursor:
        doc["id"] = doc["_id"]
        doc = serialize_document(doc)
        applications.append(doc)
    
    return {"applications": applications, "total": len(applications)}

@app.post("/api/dean/final-decision/{app_id}")
async def make_final_decision(
    app_id: str,
    payload: DeanDecisionRequest,
    current_user: dict = Depends(require_role([UserRole.DEAN], allow_dean_variants=True))
):
    decision = (payload.decision or "").strip().lower()
    remarks = payload.remarks
    if decision not in ["approve", "reject", "forward", "forward_to_director", "forward_to_research_director"]:
        raise HTTPException(status_code=400, detail="Invalid decision")
    
    app = await applications_collection.find_one({"_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in DEAN_ACTIONABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Application is not ready for Dean decision")

    enforce_paid_and_qualified(app)
    
    next_status = ApplicationStatus.REJECTED.value if decision == "reject" else ApplicationStatus.DEAN_APPROVED.value
    await applications_collection.update_one(
        {"_id": app_id},
        {
            "$set": {
                "status": next_status,
                "dean_review": {
                    "decision": decision,
                    "decided_by": current_user["_id"],
                    "dean_name": current_user["full_name"],
                    "remarks": remarks,
                    "decided_at": datetime.utcnow()
                },
                "updated_at": datetime.utcnow()
            }
        }
    )
    
    message = f"Your application {app['registration_id']} has been "
    if next_status == ApplicationStatus.DEAN_APPROVED.value:
        message += "approved by the Dean and forwarded to the Research Director."
    else:
        message += "rejected by the Dean."
    
    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": message,
        "type": "dean_review_completed",
        "created_at": datetime.utcnow(),
        "read": False
    })
    
    return {"message": f"Dean decision ({decision}) saved successfully"}

@app.post("/api/director/final-decision/{app_id}")
async def make_director_final_decision(
    app_id: str,
    payload: DirectorDecisionRequest,
    current_user: dict = Depends(require_role([UserRole.DIRECTOR]))
):
    decision = (payload.decision or "").strip().lower()
    if decision not in ["approve", "reject"]:
        raise HTTPException(status_code=400, detail="Invalid decision")

    app = await applications_collection.find_one({"_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if app.get("status") not in DIRECTOR_ACTIONABLE_STATUSES:
        raise HTTPException(status_code=400, detail="Application is not ready for Research Director decision")

    enforce_paid_and_qualified(app)

    next_status = ApplicationStatus.FINAL_APPROVED.value if decision == "approve" else ApplicationStatus.REJECTED.value
    now = datetime.utcnow()
    update_fields = {
        "status": next_status,
        "final_decision": {
            "decision": next_status,
            "decided_by": current_user["_id"],
            "director_name": current_user["full_name"],
            "remarks": payload.remarks,
            "decided_at": now
        },
        "updated_at": now,
    }

    if next_status == ApplicationStatus.FINAL_APPROVED.value:
        update_fields.update({
            "admissionDecision": None,
            "admissionRespondedAt": None,
        })

    await applications_collection.update_one(
        {"_id": app_id},
        {"$set": update_fields}
    )

    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": (
            f"Your application {app['registration_id']} has been approved by the Research Director and is ready for seat allocation."
            if next_status == ApplicationStatus.FINAL_APPROVED.value
            else f"Your application {app['registration_id']} has been rejected by the Research Director."
        ),
        "type": "application_final_approved" if next_status == ApplicationStatus.FINAL_APPROVED.value else "application_rejected",
        "created_at": datetime.utcnow(),
        "read": False,
    })

    return {"message": "Director decision saved successfully"}

# Admin Endpoints
@app.get("/api/admin/users")
async def get_all_users(
    role: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    query = {}
    if role:
        query["role"] = role
    
    users = []
    cursor = users_collection.find(query).sort("created_at", -1)
    async for doc in cursor:
        doc["id"] = doc["_id"]
        doc.pop("hashed_password", None)
        doc = serialize_document(doc)
        users.append(doc)
    
    print(f"📊 Returning {len(users)} users to admin {current_user['_id']}")
    for idx, user in enumerate(users, 1):
        print(f"   User {idx}: id={user.get('id')}, name={user.get('full_name')}, email={user.get('email')}, dept={user.get('department')}, phone={user.get('phone')}")
    
    return {"users": users, "total": len(users)}

@app.patch("/api/admin/user/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: str,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    user = await users_collection.find_one({"_id": user_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    new_status = not user.get("is_active", True)
    
    await users_collection.update_one(
        {"_id": user_id},
        {"$set": {"is_active": new_status}}
    )
    
    return {"message": f"User {'activated' if new_status else 'deactivated'} successfully"}

@app.get("/api/admin/statistics")
async def get_admin_statistics(
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    total_users = await users_collection.count_documents({})
    active_users = await users_collection.count_documents({"is_active": True})
    total_applications = await applications_collection.count_documents({})
    total_reviews = await reviews_collection.count_documents({})
    
    # Users by role
    users_by_role = {}
    for role in ["scholar", "faculty", "admin", "director", "dean"]:
        count = await users_collection.count_documents({"role": role})
        users_by_role[role] = count
    
    # Applications by status
    applications_by_status = {}
    for status in [
        "draft",
        "submitted",
        "under_scrutiny",
        "faculty_review",
        "recommended_for_interview",
        "interview_scheduled",
        "interview_completed",
        "dean_review",
        "dean_approved",
        "final_approved",
        "under_verification",
        "reviewed",
        "shortlisted",
        "approved",
        "rejected"
    ]:
        count = await applications_collection.count_documents({"status": status})
        applications_by_status[status] = count
    
    return {
        "total_users": total_users,
        "active_users": active_users,
        "users_by_role": users_by_role,
        "total_applications": total_applications,
        "total_reviews": total_reviews,
        "applications_by_status": applications_by_status
    }

@app.get("/api/admin/applications")
async def get_all_applications_admin(
    status: Optional[str] = None,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    query = {}
    if status and status != 'all':
        query["status"] = status
    
    applications = []
    cursor = applications_collection.find(query).sort([("department", 1), ("created_at", -1)])
    async for doc in cursor:
        doc["id"] = doc["_id"]
        doc = serialize_document(doc)
        applications.append(doc)
    
    return {"applications": applications, "total": len(applications)}

@app.patch("/api/admin/applications/{app_id}/exam-schedule")
async def update_application_exam_schedule(
    app_id: str,
    payload: ExamScheduleUpdateRequest,
    current_user: dict = Depends(require_role([UserRole.ADMIN]))
):
    app = await applications_collection.find_one({"_id": app_id})
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    exam_date = (payload.examDate or "").strip()
    exam_time = (payload.examTime or "").strip()
    if not exam_date or not exam_time:
        raise HTTPException(status_code=400, detail="Exam date and exam time are required")

    exam_centre = (payload.examCentre or DEFAULT_EXAM_CENTRE).strip() or DEFAULT_EXAM_CENTRE

    await applications_collection.update_one(
        {"_id": app_id},
        {
            "$set": {
                "entranceExamDate": exam_date,
                "entranceExamTime": exam_time,
                "entranceExamCentre": exam_centre,
                "updated_at": datetime.utcnow(),
            }
        }
    )

    await notifications_collection.insert_one({
        "user_id": app["scholar_id"],
        "message": (
            f"Entrance exam schedule updated for {app.get('registration_id', app_id)}: "
            f"{exam_date} at {exam_time}, {exam_centre}."
        ),
        "type": "entrance_exam_schedule_updated",
        "created_at": datetime.utcnow(),
        "read": False,
    })

    return {
        "message": "Entrance exam schedule updated successfully",
        "applicationId": app_id,
        "entranceExamDate": exam_date,
        "entranceExamTime": exam_time,
        "entranceExamCentre": exam_centre,
    }

@app.get("/api/final-rank-list")
async def get_final_rank_list(
    department: Optional[str] = None,
    institute: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    user_role = str(current_user.get("role") or "").strip().lower()
    if user_role not in {UserRole.FACULTY.value, UserRole.ADMIN.value, UserRole.DIRECTOR.value}:
        raise HTTPException(status_code=403, detail="Not authorized to view final rank list")

    requested_department = (department or "").strip()
    requested_institute = (institute or "").strip()
    if user_role == UserRole.FACULTY.value:
        requested_department = (current_user.get("department") or "").strip()

    query = {
        "candidateStatus": {"$in": [RANKED_CANDIDATE_LABEL, "Qualified for Ranking"]},
        "interviewMarks": {"$ne": None},
        "finalScore": {"$ne": None},
        "finalRank": {"$ne": None},
    }

    rows = []
    cursor = applications_collection.find(query)
    async for doc in cursor:
        app_department = get_application_department(doc)
        app_institute = get_application_institute(doc)
        if requested_department and not departments_match(requested_department, app_department):
            continue
        if requested_institute and str(app_institute or "").strip().lower() != requested_institute.lower():
            continue

        rows.append({
            "applicationId": doc.get("_id"),
            "registrationId": doc.get("registration_id"),
            "name": ((doc.get("personal_details") or {}).get("full_name")) or doc.get("scholar_name") or "N/A",
            "department": app_department or "N/A",
            "institute": app_institute or "PTU",
            "pgMarks": extract_pg_marks_for_final_score(doc),
            "entranceMarks": extract_numeric_marks(doc.get("entranceMarks")),
            "interviewMarks": extract_numeric_marks(doc.get("interviewMarks")),
            "finalScore": round(float(doc.get("finalScore") or 0), 2),
            "finalRank": int(doc.get("finalRank")),
            "candidateStatus": doc.get("candidateStatus"),
            "seatType": doc.get("seatType"),
            "seatAllocationStatus": doc.get("seatAllocationStatus") or NOT_SELECTED_LABEL,
        })

    rows.sort(key=lambda row: (str(row.get("department") or ""), str(row.get("institute") or ""), int(row.get("finalRank") or 0)))
    return {
        "rankList": rows,
        "total": len(rows),
        "department": requested_department or None,
        "institute": requested_institute or None,
        "visibleRole": user_role,
    }

@app.get("/api/seat-allocation/config")
async def get_seat_allocation_config(
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.DIRECTOR]))
):
    return {"seatConfigs": VALIDATED_SEAT_CONFIGS}

@app.post("/api/seat-allocation/run")
async def execute_seat_allocation(
    payload: SeatAllocationRunRequest,
    current_user: dict = Depends(require_role([UserRole.ADMIN, UserRole.DIRECTOR]))
):
    selected_department = (payload.department or "").strip()
    selected_institute = (payload.institute or "").strip()

    if not selected_department or selected_department.lower() == "all":
        raise HTTPException(status_code=400, detail="Department selection is mandatory for seat allocation")

    if not selected_institute or selected_institute.lower() == "all":
        raise HTTPException(status_code=400, detail="Institute selection is mandatory for seat allocation")

    selected_config = get_department_seat_config(selected_department)
    if payload.seatConfig:
        effective_config = validate_and_normalize_seat_config(
            {
                "totalSeats": payload.seatConfig.totalSeats,
                "distribution": {
                    "visvesvaraya": payload.seatConfig.distribution.visvesvaraya,
                    "merit": payload.seatConfig.distribution.merit,
                    "general": payload.seatConfig.distribution.general,
                    "obc": payload.seatConfig.distribution.obc,
                    "mbc": payload.seatConfig.distribution.mbc,
                    "sc_st": payload.seatConfig.distribution.sc_st,
                },
            }
        )
    else:
        effective_config = to_allocation_seat_config(selected_config)

    allocation_result = await run_seat_allocation(
        seat_config=effective_config,
        department=selected_department,
        institute=selected_institute,
    )

    return {
        "message": "Seat allocation completed successfully",
        "seatConfig": effective_config,
        "allocation": allocation_result,
        "executedBy": {
            "id": current_user.get("_id"),
            "name": current_user.get("full_name"),
            "role": current_user.get("role"),
            "executedAt": datetime.utcnow().isoformat(),
        },
    }

# Notifications
@app.get("/api/notifications")
async def get_notifications(
    current_user: dict = Depends(get_current_user)
):
    notifications = []
    cursor = notifications_collection.find({
        "user_id": current_user["_id"]
    }).sort("created_at", -1).limit(50)
    
    async for doc in cursor:
        doc["id"] = str(doc["_id"])
        doc = serialize_document(doc)
        notifications.append(doc)
    
    return {"notifications": notifications}

@app.patch("/api/notifications/{notif_id}/read")
async def mark_notification_read(
    notif_id: str,
    current_user: dict = Depends(get_current_user)
):
    notif_filters: List[Any] = [notif_id]
    if ObjectId.is_valid(notif_id):
        notif_filters.append(ObjectId(notif_id))

    await notifications_collection.update_one(
        {"_id": {"$in": notif_filters}, "user_id": current_user["_id"]},
        {"$set": {"read": True}}
    )
    return {"message": "Notification marked as read"}

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run(app, host="127.0.0.1", port=port)
