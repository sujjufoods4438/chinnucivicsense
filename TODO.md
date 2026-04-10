# CivicSense AI - Bug Fixes & Features TODO

## Current Task: Fix Telugu, Image Validation, Street Name, Live Detection, Progress Images

### Plan Steps (Approved by User)

✅ **Step 1: Complete Telugu i18n (te.json)**  
   - Add dashboard/complaints/progress keys  
   - ✅ te.json updated with comprehensive translations  

✅ **Step 2: Backend Model Update**  
   - ✅ Added `progressImages` array to IssueReport.js  

✅ **Step 3: Backend Controller Enhancements**  
   - ✅ New `addProgressImage` endpoint  
   - ✅ `isLiveDetection` handling  
   - [ ] Restart backend: `cd Backend && npm start`  


✅ **Step 4: Enhance AI Image Detector**  
   - ✅ Added civic/human/certificate classification  
   - ✅ Improved Google image rejection  


✅ **Step 5: CitizenDashboard.js Fixes**  
   - [ ] Full i18n translation  
   - [ ] Display progress images  

✅ **Step 6: ReportIssue.js Civic Enforcement**  
   - [ ] Reject non-civic images (human/certificate/Google)  
   - [ ] Show classification in report  

✅ **Step 7: AdminLiveDetection.js**  
   - [ ] i18n fixes  
   - [ ] Admin-only live view flag  

✅ **Step 8: AdminDashboard.js Integration**  
   - [ ] Live detections section  
   - [ ] Progress image upload UI  

✅ **Step 9: Testing & Validation**  
   - [ ] Telugu dashboard test  
   - [ ] Image rejection tests (human/Google/certificate)  
   - [ ] Live camera civic-only  
   - [ ] Progress upload flow  
   - [ ] Frontend: `npm start` | Backend: `npm start`  

**Next Action: Starting with Step 1 - i18n/te.json**

