# 🏗️ System Architecture Overview

## PhD Scholar Registration System

---

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         USER                                │
│                    (PhD Applicant)                          │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ Opens Browser
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND LAYER                           │
│                  (React + Vite)                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Multi-Step Registration Form                        │  │
│  │  • Step 1: Personal Details                          │  │
│  │  • Step 2: UG Academic                               │  │
│  │  • Step 3: PG Academic                               │  │
│  │  • Step 4: Entrance Exam                             │  │
│  │  • Step 5: Research Info                             │  │
│  │  • Step 6: Work Experience & Documents               │  │
│  │  • Step 7: Declaration                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  📱 Port: 5173                                              │
│  🎨 Design: Dark Blue Gradient + Gold                       │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ HTTP REST API
                             │ (Axios)
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    BACKEND LAYER                            │
│                  (Python FastAPI)                           │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  API Endpoints:                                      │  │
│  │  • POST /api/upload-file                             │  │
│  │  • POST /api/register                                │  │
│  │  • GET  /api/scholars                                │  │
│  │  • GET  /api/scholar/{id}                            │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Features:                                           │  │
│  │  • Data Validation (Pydantic)                        │  │
│  │  • File Upload Handling                              │  │
│  │  • Registration ID Generation                        │  │
│  │  • CORS Configuration                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  🔌 Port: 8000                                              │
│  📚 Docs: /docs (Swagger UI)                                │
└────────────────────────────┬────────────────────────────────┘
                             │
                             │ MongoDB Driver
                             │ (Motor - Async)
                             ↓
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                           │
│                  (MongoDB Atlas)                            │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Database: Phd_admission                             │  │
│  │  Collection: scholars                                │  │
│  │                                                       │  │
│  │  Document Fields:                                    │  │
│  │  • registration_id                                   │  │
│  │  • personal_details                                  │  │
│  │  • ug_details                                        │  │
│  │  • pg_details                                        │  │
│  │  • entrance_exam                                     │  │
│  │  • research_info                                     │  │
│  │  • work_experience                                   │  │
│  │  • uploaded_files                                    │  │
│  │  • declaration_agreed                                │  │
│  │  • digital_signature                                 │  │
│  │  • submission_date                                   │  │
│  │  • created_at                                        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ☁️  Cloud-hosted (Atlas)                                   │
│  🔗 Connection String in .env                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
┌──────────┐
│   User   │
│  Fills   │
│   Form   │
└────┬─────┘
     │
     ↓
┌──────────────────────────┐
│  Step 1: Personal Info   │
│  (Client-side validate)  │
└────┬─────────────────────┘
     │ Next Button
     ↓
┌──────────────────────────┐
│  Step 2: UG Details      │
│  (Client-side validate)  │
└────┬─────────────────────┘
     │ Next Button
     ↓
     ... (Steps 3-6)
     │
     ↓
┌──────────────────────────┐
│  Step 7: Declaration     │
│  (Final validation)      │
└────┬─────────────────────┘
     │ Submit Button
     ↓
┌──────────────────────────┐
│  Axios POST Request      │
│  to /api/register        │
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐
│  FastAPI Receives Data   │
│  (Pydantic validates)    │
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐
│  Generate Registration   │
│  ID (PHD + timestamp)    │
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐
│  Save to MongoDB         │
│  (scholars collection)   │
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐
│  Return Success Response │
│  with Registration ID    │
└────┬─────────────────────┘
     │
     ↓
┌──────────────────────────┐
│  Display Success Message │
│  to User                 │
└──────────────────────────┘
```

---

## 📁 File Upload Flow

```
User selects file
     │
     ↓
Frontend: onChange event triggered
     │
     ↓
Create FormData with file
     │
     ↓
POST to /api/upload-file
     │
     ↓
Backend: Receive file
     │
     ↓
Generate unique filename
(fieldname_timestamp.ext)
     │
     ↓
Save to uploads/ directory
     │
     ↓
Return filename to frontend
     │
     ↓
Store filename in state
     │
     ↓
Show "✓ Uploaded" message
     │
     ↓
Include filename in final submission
```

---

## 🎨 Frontend Component Structure

```
App.jsx (Main Component)
│
├── State Management
│   ├── formData (48 fields)
│   ├── uploadedFiles (10 files)
│   ├── currentStep (1-7)
│   ├── loading
│   ├── successMessage
│   └── errorMessage
│
├── Functions
│   ├── handleChange()
│   ├── handleFileUpload()
│   ├── nextStep()
│   ├── prevStep()
│   ├── validateStep()
│   ├── handleSubmit()
│   └── renderStep()
│
└── UI Components
    ├── Header
    │   ├── Title
    │   ├── University Name
    │   └── Welcome Message
    │
    ├── Progress Bar
    │   └── 7 Step Indicators
    │
    ├── Form Section (Dynamic)
    │   ├── Step 1: Personal Form
    │   ├── Step 2: UG Form
    │   ├── Step 3: PG Form
    │   ├── Step 4: Exam Form
    │   ├── Step 5: Research Form
    │   ├── Step 6: Work & Upload
    │   └── Step 7: Declaration
    │
    ├── Navigation Buttons
    │   ├── Previous
    │   └── Next / Submit
    │
    ├── Messages
    │   ├── Success
    │   └── Error
    │
    └── Footer
```

---

## 🔌 Backend API Structure

```
main.py
│
├── FastAPI App Setup
│   ├── CORS Middleware
│   └── MongoDB Connection
│
├── Pydantic Models
│   ├── PersonalDetails
│   ├── AcademicUG
│   ├── AcademicPG
│   ├── EntranceExam
│   ├── ResearchInfo
│   ├── WorkExperience
│   └── ScholarRegistration
│
├── API Endpoints
│   ├── GET  /
│   ├── POST /api/upload-file
│   ├── POST /api/register
│   ├── GET  /api/scholars
│   └── GET  /api/scholar/{id}
│
└── Helper Functions
    ├── File upload handling
    ├── Unique filename generation
    └── Database operations
```

---

## 🗄️ Database Schema

```
mongodb://...

Database: Phd_admission
    │
    └── Collection: scholars
            │
            └── Document
                ├── _id (ObjectId - auto)
                ├── registration_id (String)
                ├── created_at (DateTime)
                │
                ├── personal_details (Object)
                │   ├── full_name
                │   ├── date_of_birth
                │   ├── gender
                │   ├── nationality
                │   ├── category
                │   ├── aadhaar_passport
                │   ├── mobile
                │   ├── email
                │   ├── permanent_address
                │   └── communication_address
                │
                ├── ug_details (Object)
                │   ├── degree_name
                │   ├── college_university
                │   ├── branch_department
                │   ├── year_of_passing
                │   └── cgpa_percentage
                │
                ├── pg_details (Object or null)
                │   ├── degree_name
                │   ├── college_university
                │   ├── specialization
                │   ├── year_of_passing
                │   └── cgpa_percentage
                │
                ├── entrance_exam (Object)
                │   ├── exam_name
                │   ├── registration_number
                │   ├── year_of_exam
                │   ├── score_rank
                │   └── validity_period
                │
                ├── research_info (Object)
                │   ├── area_of_interest
                │   ├── proposed_topic
                │   ├── statement_of_purpose
                │   ├── preferred_supervisor
                │   ├── previous_research
                │   └── publications
                │
                ├── work_experience (Object or null)
                │   ├── company_name
                │   ├── job_role
                │   ├── years_of_experience
                │   └── field_of_work
                │
                ├── uploaded_files (Object)
                │   ├── ug_certificate
                │   ├── pg_certificate
                │   ├── exam_scorecard
                │   ├── resume
                │   ├── sop_document
                │   ├── lor
                │   ├── category_certificate
                │   ├── id_proof
                │   ├── photo
                │   └── signature
                │
                ├── declaration_agreed (Boolean)
                ├── digital_signature (String)
                └── submission_date (String)
```

---

## 🚀 Deployment Architecture

```
Development (Current):
┌────────────────────────┐
│   localhost:5173       │ React Dev Server
└───────────┬────────────┘
            │
            ↓
┌────────────────────────┐
│   localhost:8000       │ FastAPI (uvicorn)
└───────────┬────────────┘
            │
            ↓
┌────────────────────────┐
│   MongoDB Atlas        │ Cloud Database
└────────────────────────┘


Production (Recommended):
┌────────────────────────┐
│   Domain + CDN         │ Static React Build
└───────────┬────────────┘
            │
            ↓
┌────────────────────────┐
│   API Server + HTTPS   │ FastAPI (Gunicorn)
└───────────┬────────────┘
            │
            ↓
┌────────────────────────┐
│   MongoDB Atlas        │ Cloud Database
└────────────────────────┘
```

---

## 🔐 Security Layers

```
┌──────────────────────────┐
│  Input Validation        │ Frontend + Backend
├──────────────────────────┤
│  Email Validation        │ Pydantic
├──────────────────────────┤
│  File Type Restrictions  │ Accept attribute
├──────────────────────────┤
│  CORS Configuration      │ FastAPI middleware
├──────────────────────────┤
│  Environment Variables   │ .env files
├──────────────────────────┤
│  Data Validation         │ Pydantic models
└──────────────────────────┘
```

---

## 📊 Technology Stack Layers

```
┌─────────────────────────────────────────┐
│         PRESENTATION LAYER              │
│  React 18 + Vite + CSS                  │
│  (User Interface & Experience)          │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│         APPLICATION LAYER               │
│  FastAPI + Pydantic                     │
│  (Business Logic & Validation)          │
└──────────────────┬──────────────────────┘
                   │
┌──────────────────┴──────────────────────┐
│         DATA LAYER                      │
│  Motor + MongoDB Atlas                  │
│  (Data Persistence & Storage)           │
└─────────────────────────────────────────┘
```

---

## 🎯 Request Flow Timeline

```
T=0ms     User clicks "Submit"
          │
T=10ms    React validates form data
          │
T=20ms    Axios sends POST request
          │
T=50ms    Request reaches FastAPI
          │
T=60ms    Pydantic validates data
          │
T=70ms    Generate registration ID
          │
T=100ms   MongoDB write operation
          │
T=150ms   Response sent back
          │
T=180ms   Frontend receives response
          │
T=200ms   Success message displayed
```

---

## 💾 Data Persistence Flow

```
User Input
    ↓
React State (formData)
    ↓
JSON Payload
    ↓
FastAPI Request Body
    ↓
Pydantic Model
    ↓
Python Dictionary
    ↓
MongoDB Document
    ↓
Stored in Atlas Cloud
```

---

## 📈 Scalability Considerations

```
Current Capacity:
┌──────────────────────────────────────┐
│  Frontend: Handles 1000s of users    │
│  Backend: Async FastAPI (scalable)   │
│  Database: MongoDB Atlas (elastic)   │
└──────────────────────────────────────┘

For Higher Load:
┌──────────────────────────────────────┐
│  Add: Load Balancer                  │
│  Add: Multiple Backend Instances     │
│  Add: Redis Cache                    │
│  Add: CDN for Static Files           │
│  Upgrade: MongoDB Cluster Tier       │
└──────────────────────────────────────┘
```

---

## 🔄 Development Workflow

```
Code Change
    ↓
Hot Reload (Vite/Uvicorn)
    ↓
Browser Auto-refresh
    ↓
Test Feature
    ↓
Check Logs
    ↓
Verify MongoDB
    ↓
Commit Changes
```

---

**Architecture Overview Complete! 🏗️**

*This system is designed for scalability, maintainability, and ease of use!*
