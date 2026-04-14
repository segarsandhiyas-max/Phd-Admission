# 📋 Form Fields Reference Guide

## Complete List of All Form Fields

---

## STEP 1: Personal Details (10 fields)

| Field Name | Type | Required | Validation |
|------------|------|----------|------------|
| Full Name | Text | Yes | - |
| Date of Birth | Date | Yes | - |
| Gender | Select | Yes | Male/Female/Other |
| Nationality | Text | Yes | - |
| Category | Select | Yes | OC/OBC/SC/ST/EWS |
| Aadhaar / Passport Number | Text | Yes | - |
| Mobile Number | Tel | Yes | 10 digits |
| Email ID | Email | Yes | Valid email |
| Permanent Address | Textarea | Yes | - |
| Communication Address | Textarea | Yes | - |

---

## STEP 2: Academic Details - Undergraduate (5 fields)

| Field Name | Type | Required | Example |
|------------|------|----------|---------|
| Degree Name | Text | Yes | B.E / B.Tech / B.Sc |
| College / University Name | Text | Yes | - |
| Branch / Department | Text | Yes | Computer Science |
| Year of Passing | Text | Yes | 2020 |
| CGPA / Percentage | Text | Yes | 8.5 / 85% |

---

## STEP 3: Academic Details - Postgraduate (5 fields - Optional)

| Field Name | Type | Required | Example |
|------------|------|----------|---------|
| Degree Name | Text | No | M.E / M.Tech / M.Sc |
| College / University | Text | No | - |
| Specialization | Text | No | Data Science |
| Year of Passing | Text | No | 2022 |
| CGPA / Percentage | Text | No | 9.0 / 90% |

---

## STEP 4: Entrance Examination Details (5 fields)

| Field Name | Type | Required | Example |
|------------|------|----------|---------|
| Exam Name | Text | Yes | GATE / NET / JRF |
| Registration Number | Text | Yes | GATE2024123456 |
| Year of Exam | Text | Yes | 2024 |
| Score / Rank | Text | Yes | 650 / AIR 1234 |
| Validity Period | Text | Yes | 2024-2027 |

---

## STEP 5: Research Information (6 fields)

| Field Name | Type | Required | Example |
|------------|------|----------|---------|
| Area of Interest | Text | Yes | AI, Data Science, Networks |
| Proposed Research Topic | Text | Yes | - |
| Statement of Purpose | Textarea | Yes | - |
| Preferred Supervisor | Text | Yes | Dr. John Doe |
| Previous Research | Textarea | No | - |
| Publications | Textarea | No | - |

---

## STEP 6: Work Experience (4 fields - Optional)

| Field Name | Type | Required | Example |
|------------|------|----------|---------|
| Company / Organization | Text | No | Tech Corp |
| Job Role | Text | No | Software Engineer |
| Years of Experience | Text | No | 3 years |
| Field of Work | Text | No | Web Development |

---

## STEP 6: Document Upload (10 document types)

| Document | File Type | Required | Notes |
|----------|-----------|----------|-------|
| UG Mark Sheets & Degree | PDF/JPG/PNG | Recommended | - |
| PG Mark Sheets & Degree | PDF/JPG/PNG | If applicable | - |
| Entrance Exam Score Card | PDF/JPG/PNG | Recommended | - |
| Resume / CV | PDF | Recommended | - |
| Statement of Purpose | PDF | Recommended | - |
| Recommendation Letters | PDF | Recommended | - |
| Category Certificate | PDF/JPG/PNG | If applicable | - |
| ID Proof | PDF/JPG/PNG | Recommended | Aadhaar/Passport |
| Passport Size Photo | JPG/PNG | Recommended | - |
| Signature | JPG/PNG | Recommended | - |

---

## STEP 7: Declaration (3 fields)

| Field Name | Type | Required | Notes |
|------------|------|----------|-------|
| Declaration Checkbox | Checkbox | Yes | Must agree |
| Digital Signature | Text | Yes | Type full name |
| Submission Date | Date | Yes | Auto-filled |

---

## 📊 Field Summary

**Total Fields:** 48 fields + 10 file uploads = 58 inputs

**Breakdown:**
- Required fields: 32
- Optional fields: 16
- File uploads: 10

**By Type:**
- Text inputs: 28
- Select dropdowns: 2
- Textareas: 4
- Date inputs: 2
- Tel input: 1
- Email input: 1
- Checkbox: 1
- File inputs: 10

---

## 🔍 Field Validation Rules

### Email Validation
- Must be valid email format
- Example: user@example.com

### Mobile Validation
- Must be exactly 10 digits
- Example: 9876543210

### Required Field Validation
- Cannot be empty
- Validated on step change
- Alert shown if missing

### File Upload Validation
- Accepted formats:
  - PDF: `.pdf`
  - Images: `.jpg`, `.jpeg`, `.png`
- Files stored with unique timestamps

---

## 🎨 Input Styling

All form inputs have:
- 2px border (neutral color)
- 8px border radius
- 0.75rem padding
- Focus state with blue border
- Hover effects
- Consistent typography

---

## 📱 Responsive Behavior

**Desktop (>768px):**
- 2 columns grid layout
- Full-width for textareas

**Tablet (768px):**
- 1 column layout
- Stacked inputs

**Mobile (<480px):**
- 1 column layout
- Full-width buttons
- Touch-friendly sizes

---

## 💡 Field Instructions for Users

### Personal Details
- Use official name as per certificates
- Category determines certificate requirements
- Aadhaar preferred, Passport for international

### Academic Details
- UG details required for all
- PG optional but recommended if applicable
- Marks/CGPA as per final certificate

### Entrance Exam
- GATE/NET/JRF most common
- Include validity period
- Score or rank as applicable

### Research Info
- Be specific about research area
- SOP should be detailed (500+ words)
- List all publications if any

### Work Experience
- Optional but valuable
- Include relevant experience only
- Focus on research-related work

### Documents
- Scan clearly (readable)
- PDF preferred for certificates
- File size <5MB per file
- Use original file names

### Declaration
- Read carefully before agreeing
- Digital signature = typed full name
- Date auto-filled to current date

---

## 🚀 Data Submission

When form is submitted, data is structured as:

```json
{
  "personal_details": { ... },
  "ug_details": { ... },
  "pg_details": { ... } or null,
  "entrance_exam": { ... },
  "research_info": { ... },
  "work_experience": { ... } or null,
  "declaration_agreed": true,
  "digital_signature": "...",
  "submission_date": "2026-02-10",
  "uploaded_files": { ... },
  "registration_id": "PHD20260210123456",
  "created_at": "2026-02-10T10:30:00"
}
```

---

## ✅ Quality Checklist for Users

Before submitting, ensure:
- [ ] All required fields filled
- [ ] Email is valid and accessible
- [ ] Mobile number is correct
- [ ] Academic details match certificates
- [ ] Entrance exam details verified
- [ ] Research proposal is clear
- [ ] All documents uploaded
- [ ] Documents are readable
- [ ] Declaration agreed
- [ ] Digital signature provided

---

**Field reference complete! Ready to register! 🎓**
