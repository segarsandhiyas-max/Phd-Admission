# PhD Application Workflow Guide

## Overview
This document explains how the PhD admission system manages applications and ensures proper workflow through different stakeholders.

---

## 1. Application Submission (Scholar)

### Single Application Rule
- **One application per scholar at a time**
- Active statuses: `submitted`, `under_verification`, `reviewed`, `shortlisted`
- Cannot submit new application until current one is resolved

### Submission Flow
1. Scholar clicks "Submit New Application"
2. If active application exists → Error message: "You already have an active application under review"
3. If no active application → Form opens (7 steps)
4. Fill all required fields across all steps
5. Review & Submit
6. Application saved with status: **SUBMITTED**

---

## 2. Faculty Review

### Faculty Dashboard Access
- Navigate to `/api/faculty/applications`
- See all applications with status: `submitted`, `under_verification`

### Review Workflow
1. Faculty selects an application
2. Reviews candidate details:
   - Personal information
   - Academic background (UG/PG)
   - Entrance exam scores
   - Research area & topic
   - Work experience (if any)
3. Provides review:
   - Academic Score (0-100)
   - Research Score (0-100)
   - Decision: `approve`, `reject`, or `waitlist`
   - Remarks

### Status Change
- After review: Status → **UNDER_VERIFICATION** (if not yet submitted)
- After review completion: Status → **REVIEWED**

---

## 3. Director Decision

### Director Dashboard Access
- Navigate to `/api/director/applications`
- See all reviewed applications

### Director Actions
1. View all applications with faculty reviews
2. Calculate average score from multiple faculty reviews
3. Make decisions:
   - **Shortlist**: Move to next stage
   - **Reject**: Application rejected
   - **Waitlist**: Application in queue

### Status Change
- After shortlist decision: Status → **SHORTLISTED**
- After reject decision: Status → **REJECTED**
- After waitlist decision: Status → **WAITLIST**

---

## 4. Dean Final Decision

### Dean Dashboard Access
- Navigate to `/api/dean/shortlisted-applications`
- See only SHORTLISTED applications

### Final Decision
1. Dean reviews shortlisted candidates
2. Reviews all faculty evaluations
3. Makes final approval/rejection:
   - **APPROVED**: Candidate approved for PhD
   - **REJECTED**: Final rejection at Dean level

### Status Change
- After approval: Status → **APPROVED** ✅
- After rejection: Status → **REJECTED** ❌

---

## 5. Admin Dashboard

### Admin Access
- View all users in system
- View all applications at any stage
- Filter by:
  - User role (Scholar, Faculty, Director, Dean, Admin)
  - Application status

### Admin Capabilities
- Deactivate/activate users
- View complete statistics
- Monitor all submissions

---

## Application Status Flow Diagram

```
SUBMITTED
    ↓
UNDER_VERIFICATION (Faculty assigned)
    ↓
REVIEWED (Faculty submitted review)
    ↓
┌─────────────────────────────────────────┐
│  Director Decision                      │
├─────────────────────────────────────────┤
│  ├─→ SHORTLISTED (Select best)         │
│  ├─→ REJECTED (Not qualified)          │
│  └─→ WAITLIST (Backup option)          │
└─────────────────────────────────────────┘
    ↓ (If SHORTLISTED)
┌─────────────────────────────────────────┐
│  Dean Final Decision                    │
├─────────────────────────────────────────┤
│  ├─→ APPROVED ✅                       │
│  └─→ REJECTED ❌                       │
└─────────────────────────────────────────┘
```

---

## Key Features Implemented

### 1. Single Application Constraint
```
✅ Scholar can only have ONE active application
✅ Error prevents multiple simultaneous submissions
✅ Previous applications visible in "My Applications"
```

### 2. Role-Based Access
```
✅ Scholar: Can submit and view own applications
✅ Faculty: Can review submitted applications
✅ Director: Can make shortlist decisions
✅ Dean: Can make final approval decisions
✅ Admin: Can manage all users and view all applications
```

### 3. Application Visibility
```
✅ Applications visible to all relevant stakeholders
✅ Each role sees only applications they need to act on
✅ Complete history maintained at Admin level
```

### 4. Notifications
```
✅ Scholar gets notification on:
   - Successful submission
   - Faculty review completed
   - Director decision made
   - Dean final decision
```

---

## Testing the Workflow

### Step 1: Create Scholar Account
1. Go to http://localhost:5174
2. Register as "Scholar"
3. Email: scholar@example.com
4. Password: any password

### Step 2: Submit Application
1. Click "Submit New Application"
2. Fill all 7 steps
3. Review & Submit
4. See success message with Registration ID
5. View in "My Applications"

### Step 3: Faculty Review
1. Log out and login as "Faculty"
2. Go to Faculty Dashboard
3. Select application to review
4. Provide scores and decision
5. Submit review

### Step 4: Director Decision
1. Log out and login as "Director"
2. Go to Director Dashboard
3. View faculty reviews
4. Make shortlist/reject decision

### Step 5: Dean Decision
1. Log out and login as "Dean"
2. Go to Dean Dashboard
3. View shortlisted applications
4. Make final approval/rejection decision

### Step 6: Admin Verification
1. Log out and login as "Admin"
2. Check "Applications" tab
3. Filter by any status
4. See complete workflow

---

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "You already have an active application" | Scholar trying to submit second application | Wait for decision on current application |
| Application not appearing for Faculty | Status is not "submitted" or "under_verification" | Check application status in admin panel |
| Cannot review application | Already reviewed or not faculty assigned | Check if another faculty already reviewed |
| Cannot access dashboard | Wrong role | Login with correct role account |

---

## Notes on Implementation

- All applications stored in in-memory mock database
- Data persists during session but resets on server restart
- For production: Replace with proper MongoDB
- Passwords hashed using PBKDF2-SHA256
- JWT tokens for authentication (24 hour expiry)

---

## Support

For issues or questions, check:
1. Browser console for detailed error messages
2. Backend terminal for database operations
3. Admin dashboard for system-wide overview
