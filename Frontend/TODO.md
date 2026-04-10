# AI Model Fix & Custom Civic Detector TODO

## [x] Phase 1: Immediate Model Loading Fix ✅
- [x] 1.1 cd Frontend1/NRIIT-main && npm install
- [x] 1.2 Test dev server: npm start → check console/model load
- [x] 1.3 Edit AdminLiveDetection.js: Add loading progress, retry, backend selector, fallback
- [x] 1.4 Test live detection with fallback

**AI model loading fixed! Fallback mode active. Ready for Phase 2 custom CNN.**

## [ ] Phase 2: Custom CNN Civic Issue Detector
- [ ] 2.1 Create dataset collection script/links
- [ ] 2.2 Train MobileNetV2 + custom head (92% acc)
- [ ] 2.3 Convert to TF.js Lite, deploy to public/models/
- [ ] 2.4 Integrate into aiImageDetector.js + AdminLiveDetection.js
- [ ] 2.5 Full testing + docs update

## Progress Tracking
Current: Starting Phase 1

