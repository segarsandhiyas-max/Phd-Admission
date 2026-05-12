# Visvesvaraya Scheme - Quick Configuration Reference

## Configuration Constants (in backend/main.py)

```python
# ============================================
# VISVESVARAYA PHD SCHEME (PHASE-II) CONFIG
# ============================================

VISVESVARAYA_SCHEME_CONFIG = {
    "enabled": True,  # Set to False to disable scheme
    "seats": 1,       # Number of Visvesvaraya seats to allocate
    "eligible_departments": [
        "CSE", "IT", "ECE", "CE", "EEE", "EIE", "ME", "MATHS", "HSS"
    ],
    "required_status": "Accepted",  # Required admission status
}

VISVESVARAYA_FELLOWSHIP_SUPPORT = {
    "fellowship_type": "Visvesvaraya",
    "stipend_year_1_2": 38750,      # ₹38,750/month for Year 1-2
    "stipend_year_3_5": 43750,      # ₹43,750/month for Year 3-5
    "research_grant": 120000,        # ₹1,20,000/year
    "rent_support": "As per govt norms",
    "international_conference_support": "From 3rd year onwards",
    "lab_visit_abroad_support": "6 months support",
    "max_duration_years": 5,         # Up to 5 years
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
```

## Key Helper Functions

### Check Eligibility
```python
def is_eligible_for_visvesvaraya(candidate_doc: dict, department: str) -> bool:
    """
    Returns True if candidate is eligible for Visvesvaraya scheme
    Checks:
    - Department match
    - Admission status
    - No prior seat allocation
    - No admission rejection
    """
    # Implementation checks:
    # 1. Scheme enabled
    # 2. Department in eligible list
    # 3. Status in [FINAL_APPROVED, ACCEPTED, ADMISSION_CONFIRMED]
    # 4. Not already allocated seat
    # 5. Admission decision != "reject"
```

### Assign Fellowship
```python
def assign_visvesvaraya_fellowship(candidate_doc: dict) -> dict:
    """
    Returns dictionary of fellowship fields to add to candidate
    Fields include:
    - Stipend amounts
    - Research grant
    - Support details
    - Fellowship status
    - Scheme rules
    """
```

## Allocation Sequence

When `POST /api/seat-allocation/run` is called:

```
1. Fetch ranked candidates (status: RANKED)
2. Group by department/institute
3. For each group:
   a. Sort by final_score (descending)
   b. VISVESVARAYA allocation (NEW - first priority)
      - For each candidate in ranked list:
        - If eligible_for_visvesvaraya AND count < seats
          - Allocate to VISVESVARAYA
          - Assign fellowship package
   c. MERIT allocation (existing logic)
   d. CATEGORY allocation (existing logic)
   e. LAPSE allocation (existing logic)
4. Update all candidates in database
5. Return allocation summary
```

## Database Fields Added (at allocation time)

When a candidate gets Visvesvaraya seat:

```javascript
{
  "_id": ObjectId(...),
  "seat_type": "VISVESVARAYA",                          // Seat type
  "fellowship_type": "Visvesvaraya",                    // Fellowship name
  "stipend_year1_2": 38750,                             // Monthly stipend Y1-2
  "stipend_year3_5": 43750,                             // Monthly stipend Y3-5
  "research_grant_annual": 120000,                      // Annual research grant
  "rent_support": "As per govt norms",                  // Rent support info
  "international_conference_support": "From 3rd year...", // Conf support
  "lab_visit_abroad_support": "6 months support",       // Lab visit support
  "fellowship_duration_years": 5,                       // Max duration
  "fellowship_status": "Active",                        // Fellowship status
  "fellowship_allocated_date": ISODate(...),            // Allocation date
  "fellowship_scheme_rules": {...},                     // Scheme rules
  "visvesvaraya_scheme_phase": "Phase-II",             // Scheme phase
  // ... existing fields remain unchanged
}
```

## Frontend Display Conditions

### Show Visvesvaraya Details
```javascript
if (String(seatType).toUpperCase() === 'VISVESVARAYA')
{
  // Display fellowship details section
  // Shows in two locations:
  // 1. Admission Process (when currentIndex >= 12)
  // 2. Final Summary (when stage === 'Admission Confirmed')
}
```

### Data Accessed
```javascript
app.fellowship_type
app.visvesvaraya_scheme_phase
app.stipend_year1_2
app.stipend_year3_5
app.research_grant_annual
app.rent_support
app.international_conference_support
app.lab_visit_abroad_support
app.fellowship_duration_years
app.fellowship_status
```

## API Response Changes

Allocation summary now includes:

```json
{
  "groups": [
    {
      "department": "CSE",
      "categoryAllocation": {
        "VISVESVARAYA": 1,    // NEW FIELD
        "MERIT": 3,
        "GENERAL": 2,
        "OBC": 2,
        "MBC": 1,
        "SC_ST": 2,
        "LAPSE": 2
      },
      "visvesvaraya_scheme": {  // NEW SECTION
        "enabled": true,
        "allocated_seats": 1,
        "max_seats": 1
      }
    }
  ]
}
```

## Quick Changes

### Enable/Disable Scheme
```python
# In backend/main.py
VISVESVARAYA_SCHEME_CONFIG["enabled"] = False  # Disable
VISVESVARAYA_SCHEME_CONFIG["enabled"] = True   # Enable
```

### Change Seats
```python
VISVESVARAYA_SCHEME_CONFIG["seats"] = 2  # Allocate 2 seats instead of 1
```

### Update Fellowship Amounts
```python
VISVESVARAYA_FELLOWSHIP_SUPPORT["stipend_year_1_2"] = 40000
VISVESVARAYA_FELLOWSHIP_SUPPORT["stipend_year_3_5"] = 45000
VISVESVARAYA_FELLOWSHIP_SUPPORT["research_grant"] = 150000
```

### Restrict Departments
```python
VISVESVARAYA_SCHEME_CONFIG["eligible_departments"] = ["CSE", "IT"]
```

## Testing Commands

### View Allocation with Visvesvaraya

```bash
curl -X POST http://localhost:8000/api/seat-allocation/run \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "department": "CSE",
    "institute": "PTU",
    "seatConfig": {
      "totalSeats": 10,
      "distribution": {
        "merit": 3,
        "general": 2,
        "obc": 2,
        "mbc": 1,
        "sc_st": 2
      }
    }
  }'
```

### Check Candidate Fellowship

```bash
db.applications.findOne({
  seatType: "VISVESVARAYA",
  fellowship_status: "Active"
})
```

## Allocation Flow Diagram

```
Ranked Candidates
       ↓
   Sort by Score
       ↓
   ┌───────────────────────────────────────────┐
   │ STEP 1: VISVESVARAYA (NEW)                │
   │ - Check eligibility                       │
   │ - Allocate top-ranked eligible            │
   │ - Attach fellowship package               │
   │ - Count: Up to N (configured)             │
   └───────────────────────────────────────────┘
       ↓ (remaining candidates)
   ┌───────────────────────────────────────────┐
   │ STEP 2: MERIT                             │
   │ - Fill merit seats                        │
   │ - Count: M (configured)                   │
   └───────────────────────────────────────────┘
       ↓
   ┌───────────────────────────────────────────┐
   │ STEP 3: CATEGORY (SC/ST, OBC, MBC, etc)  │
   │ - Fill category-reserved seats            │
   │ - Count: C (configured)                   │
   └───────────────────────────────────────────┘
       ↓
   ┌───────────────────────────────────────────┐
   │ STEP 4: LAPSE (30%)                       │
   │ - Fill lapse seats beyond base            │
   │ - Count: L (auto-calculated)              │
   └───────────────────────────────────────────┘
       ↓
   Total Allocated = N + M + C + L
   Remaining = NOT SELECTED
```

## Non-Breaking Guarantees

✅ **No Schema Changes**: Fellowship fields added at runtime only
✅ **No Logic Changes**: MERIT/CATEGORY/LAPSE work exactly as before
✅ **Backward Compatible**: Old candidates/applications unaffected
✅ **Configurable**: Can be disabled or modified without code change
✅ **Isolated**: Visvesvaraya logic separate from existing allocation

## Key Differences from Manual Addition

**Before**: If you manually added Visvesvaraya seats
```
total = 10 + 3 (lapse) = 13 MERIT/CATEGORY/LAPSE seats only
```

**Now**: With Visvesvaraya scheme
```
total = 1 (VISVESVARAYA) + 10 (MERIT/CATEGORY) + 3 (LAPSE) = 14 seats
BUT: Visvesvaraya counts toward overall allocation, not extra seats
```

The elegance: Visvesvaraya takes **one of the top seats** but from the **eligible pool**, ensuring merit is maintained while providing scheme benefits.

---

**Version**: 1.0
**Release Date**: April 21, 2026
**Status**: Production Ready ✅
