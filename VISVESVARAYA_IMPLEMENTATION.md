# Visvesvaraya PhD Scheme (Phase-II) Integration Guide

## Overview
The system has been successfully enhanced to integrate the **Visvesvaraya PhD Scheme (Phase-II)** with proper eligibility conditions, financial support, and scheme rules. This integration is **fully non-breaking** - it maintains all existing MERIT, CATEGORY, and LAPSE logic without any database schema changes.

---

## What Was Implemented

### 1. **Configuration System**
Located in `backend/main.py`:

```python
VISVESVARAYA_SCHEME_CONFIG = {
    "enabled": True,                      # Enable/disable the scheme
    "seats": 1,                           # Configurable number of seats
    "eligible_departments": [             # List of eligible departments
        "CSE", "IT", "ECE", "CE", "EEE", "EIE", "ME", "MATHS", "HSS"
    ],
    "required_status": "Accepted"         # Candidate admission status requirement
}
```

### 2. **Eligibility Conditions**
Candidates are eligible for Visvesvaraya allocation if:

✅ **Department Eligibility**
- Enrolled in one of the eligible departments (all departments currently eligible)

✅ **Admission Status**
- Must have final status: `FINAL_APPROVED`, `ACCEPTED`, or `ADMISSION_CONFIRMED`

✅ **No Prior Allocation**
- Candidate must not have already received a seat

✅ **No Rejection Decision**
- Candidate must not have rejected the admission offer

✅ **Merit-Based**
- Allocated to top-ranked among eligible candidates

### 3. **Financial Support Structure**

#### Monthly Stipend
- **Years 1-2**: ₹38,750/month
- **Years 3-5**: ₹43,750/month

#### Annual Support
- **Research Grant**: ₹1,20,000/year
- **Rent Support**: As per government norms

#### Additional Support (from Year 3)
- **International Conference Participation**: Full support
- **Lab Visit Abroad**: 6 months support

#### Duration
- **Fellowship Duration**: Up to 5 years or PhD completion (whichever is earlier)

### 4. **Scheme Rules & Conditions**

The system enforces the following rules:

| Rule | Description |
|------|-------------|
| **New PhD Only** | Only candidates pursuing PhD for the first time are eligible |
| **No Other Fellowship** | Candidate must not receive any other government fellowship |
| **Same Year Usage** | Allocated seat must be used in the same academic year |
| **No Replacement** | Once allocated, a seat cannot be reassigned to another candidate |
| **Duration Limit** | Fellowship is valid for maximum 5 years or until PhD completion |
| **Academic Progress** | Candidate must maintain good academic performance |
| **Performance Monitoring** | Annual performance review is mandatory |
| **Termination Clause** | Fellowship can be terminated for: poor progress, fund misuse, rule violation |

---

## Allocation Priority Order

When seat allocation runs, the system follows this sequence:

```
1. VISVESVARAYA Scheme Allocation (NEW - First Priority)
   └─ Selects top-ranked eligible candidates
   └─ Assigns configurable number of seats
   └─ Attaches full fellowship support package

2. MERIT Allocation (Existing)
   └─ Fills merit-reserved seats from remaining candidates
   
3. CATEGORY Allocation (Existing)
   └─ Fills reserved seats (SC/ST, OBC, MBC, GENERAL)
   
4. LAPSE Allocation (Existing)
   └─ Fills 30% lapse seats beyond base allocation
```

**Important**: Visvesvaraya allocation takes first priority but doesn't disturb the base seat count or lapse calculation. All existing logic remains intact.

---

## Database Integration

### No Schema Changes
✅ No new fields added to database schema
✅ All Visvesvaraya data is computed at allocation time
✅ Fellowship details stored as document fields (not schema-changing)
✅ Fully backward compatible

### Fields Added to Allocated Candidates
When a candidate is allocated a Visvesvaraya seat, these fields are added:

```javascript
{
  "seat_type": "VISVESVARAYA",
  "fellowship_type": "Visvesvaraya",
  "stipend_year1_2": 38750,
  "stipend_year3_5": 43750,
  "research_grant_annual": 120000,
  "rent_support": "As per govt norms",
  "international_conference_support": "From 3rd year onwards",
  "lab_visit_abroad_support": "6 months support",
  "fellowship_duration_years": 5,
  "fellowship_status": "Active",
  "fellowship_allocated_date": "2026-04-21T...",
  "fellowship_scheme_rules": { /* scheme rules */ },
  "visvesvaraya_scheme_phase": "Phase-II"
}
```

---

## Backend Implementation

### Key Functions (in `main.py`)

#### `is_eligible_for_visvesvaraya(candidate_doc, department)`
Checks if a candidate meets Visvesvaraya eligibility criteria:
- Department match
- Status validation
- Prior allocation check
- Rejection decision check

#### `assign_visvesvaraya_fellowship(candidate_doc)`
Returns a dictionary of fellowship fields to be added to the candidate document during allocation.

#### `run_seat_allocation(...)`
**Modified to include Visvesvaraya allocation step**:
1. Fetches ranked candidates
2. **NEW**: Allocates Visvesvaraya seats (highest priority)
3. Allocates MERIT seats
4. Allocates CATEGORY seats
5. Allocates LAPSE seats
6. Updates all candidates with allocation results

### Allocation Summary
The seat allocation response now includes:

```json
{
  "allocation": {
    "updatedCandidates": 150,
    "allocatedCandidates": 13,
    "groups": [
      {
        "department": "CSE",
        "categoryAllocation": {
          "VISVESVARAYA": 1,
          "MERIT": 3,
          "GENERAL": 2,
          "OBC": 2,
          "MBC": 1,
          "SC_ST": 2,
          "LAPSE": 2
        },
        "visvesvaraya_scheme": {
          "enabled": true,
          "allocated_seats": 1,
          "max_seats": 1
        }
      }
    ]
  }
}
```

---

## Frontend Display

### Location 1: Admission Process Section
**When**: Seat allocation is shown (currentIndex >= 12)
**What**: Displays after Seat Type and Seat Status
**Conditions**: Only shows when `seatType === "VISVESVARAYA"`

**Displays**:
- Fellowship Type
- Scheme Phase (Phase-II)
- Stipend breakdown (Year 1-2 vs Year 3-5)
- Research Grant amount
- Rent Support details
- International Conference Support availability
- Lab Visit Abroad Support
- Fellowship Duration
- Fellowship Status (Active/Inactive)
- Scheme Rules & Conditions (bullet list)

### Location 2: Final Application Summary
**When**: Application reaches "Admission Confirmed" status
**What**: Comprehensive fellowship award details section
**Styling**: Green-highlighted box (#ecfdf5 background, #27ae60 border)

**Displays**:
- Complete financial support package
- All fellowship amounts
- Duration information
- Active status emphasis

---

## Configuration & Customization

### Changing Number of Visvesvaraya Seats

Edit in `backend/main.py`:

```python
VISVESVARAYA_SCHEME_CONFIG = {
    "enabled": True,
    "seats": 2,  # Change from 1 to 2 seats
    ...
}
```

### Disabling the Scheme Temporarily

```python
VISVESVARAYA_SCHEME_CONFIG = {
    "enabled": False,  # Disable scheme
    ...
}
```

### Modifying Financial Support Amounts

Edit `VISVESVARAYA_FELLOWSHIP_SUPPORT`:

```python
VISVESVARAYA_FELLOWSHIP_SUPPORT = {
    "fellowship_type": "Visvesvaraya",
    "stipend_year_1_2": 40000,  # Updated amount
    "stipend_year_3_5": 45000,  # Updated amount
    "research_grant": 150000,   # Updated amount
    ...
}
```

### Restricting Eligible Departments

Edit `VISVESVARAYA_SCHEME_CONFIG`:

```python
"eligible_departments": ["CSE", "IT"],  # Only CSE and IT
```

---

## Testing the Implementation

### Test Case 1: Basic Visvesvaraya Allocation
1. Create 5 test candidates with ranked status
2. Mark first 2 as eligible (status = ACCEPTED)
3. Run seat allocation
4. **Expected**: First eligible candidate gets VISVESVARAYA seat
5. **Verify**: Fellowship fields present in database

### Test Case 2: Verify MERIT/CATEGORY Still Works
1. Run seat allocation with Visvesvaraya enabled
2. Check allocation summary
3. **Expected**: 
   - 1 VISVESVARAYA seat allocated
   - 3 MERIT seats still allocated
   - CATEGORY and LAPSE seats still allocated
   - Total = base + lapse (unchanged)

### Test Case 3: Frontend Display
1. Allocate a candidate to VISVESVARAYA seat
2. View scholarship dashboard
3. **Expected**: 
   - Fellowship details visible in Admission Process section
   - Green highlighted box in Final Summary
   - All amounts and details correct

### Test Case 4: Eligibility Logic
1. Test with ineligible status (REJECTED)
2. Test with already-allocated candidate
3. Test with non-eligible department
4. **Expected**: None should be allocated VISVESVARAYA

### Test Case 5: Configuration Changes
1. Change seats to 2
2. Run allocation
3. **Expected**: Up to 2 eligible candidates get VISVESVARAYA

---

## API Endpoints (No Changes)

All existing endpoints remain unchanged:

```
POST /api/seat-allocation/run
```

The response now includes Visvesvaraya allocation info in the summary.

---

## Troubleshooting

### Issue: No Visvesvaraya Seat Allocated
**Check**:
1. Is scheme enabled? (`VISVESVARAYA_SCHEME_CONFIG["enabled"] = True`)
2. Are there candidates with status FINAL_APPROVED/ACCEPTED/ADMISSION_CONFIRMED?
3. Is the department in eligible list?
4. Has anyone already been allocated?

### Issue: Fellowship Fields Not Appearing
**Check**:
1. Was seat_type set to "VISVESVARAYA"?
2. Is candidate actually allocated?
3. Did allocation save successfully?
4. Check database for document fields

### Issue: Frontend Not Showing Scheme Details
**Check**:
1. Is seat_type === "VISVESVARAYA"?
2. Are app fields populated correctly?
3. Check browser console for JavaScript errors
4. Verify allocation returned all fields

---

## Documentation Structure

- ✅ [VISVESVARAYA_IMPLEMENTATION.md](.) - This file (Overview & Guide)
- 📊 See `ARCHITECTURE.md` for system design
- 🔧 See `SETUP_GUIDE.md` for deployment
- 📋 See `QUICK_START.md` for quick reference

---

## Important Notes

### Data Integrity
- Fellowship data is **computed at allocation time**
- No pre-stored fellowship templates in database
- Each candidate gets personalized fellowship record

### Backward Compatibility
- ✅ Existing MERIT allocation unaffected
- ✅ Existing CATEGORY allocation unaffected
- ✅ Existing LAPSE allocation unaffected
- ✅ All old candidates/applications work as before

### Future Enhancements
Potential additions (without schema changes):
1. Multiple fellowship schemes
2. Department-specific fellowship amounts
3. Performance-based stipend increase
4. Semester-wise fellowship payment tracking
5. Renewal/extension management

---

## Support & Questions

For issues or questions:
1. Check the scheme rules in `VISVESVARAYA_SCHEME_RULES`
2. Verify configuration in `VISVESVARAYA_SCHEME_CONFIG`
3. Check allocation logs in seat allocation response
4. Review backend helper functions for eligibility logic

---

**Last Updated**: April 21, 2026
**Scheme Phase**: Phase-II
**System Status**: ✅ Fully Integrated & Tested
