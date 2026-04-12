# IssueReport Enum Fix Plan

**Problem:** `tub, vat` not valid enum value for issueType

**Status:** 
- Model: No enum
- Controller: Mock random OK
- Frontend AI: Sets civicType: 'garbage', 'pothole' etc.

**Fix:** Add enum to model + map AI results

**Step 1:** ✅ Understand files
**Step 2:** ✅ IssueReport enum added + controller normalized issueType to 'other'
