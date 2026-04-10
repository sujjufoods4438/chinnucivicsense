# 🎥 Admin Live Camera Issue Detection - User Guide

## ✨ Feature Overview
Dedicated real-time camera system exclusively for **Admin/Judge login** to demonstrate automated civic issue detection using AI. Perfect for impressing stakeholders with live demonstrations.

---

## 🚀 How to Access

### Step 1: Admin Login
1. Go to **http://localhost:3000/admin-login**
2. Enter Admin Email & Password
3. You will be redirected to **Admin Dashboard**

### Step 2: Launch Live Detection
1. Look for the **"🎥 Live Detection"** button in the top-right corner of Admin Dashboard (next to Notification bell)
2. Click the button → You'll be taken to the dedicated **Live Camera Issue Detection** page

---

## 📹 Using Live Camera Detection

### Camera Launch
- Click **"📹 Start Live Camera"** button
- **Grant camera permission** when the browser asks
- Live video feed will appear (preferably landscape mode → 16:9 aspect ratio)

### Capturing & Analyzing
1. **Point camera** at civic infrastructure (pothole, garbage, broken streetlight, water leak, etc.)
2. Click **"📸 Capture & Analyze"** button
3. System will:
   - 📸 Capture the current video frame
   - 🔍 Verify if image is real (not AI-generated)
   - 🤖 Run AI classification using MobileNet
   - ✅ Detect civic issue type (pothole, garbage, streetlight, water_leak, damaged_road, etc.)
   - 📊 Calculate confidence scores

### Detection Results Panel (Right Side)
Shows:
- **Issue Type**: pothole | garbage | water_leak | streetlight | damaged_road
- **AI Label**: What MobileNet classified the image as
- **Confidence %**: How likely the AI is on its classification (0-100%)
- **Real Score %**: How confident the system is that the image is real (not AI-generated)

### Auto-Submit to System
1. Once issue is detected successfully ✅
2. Click **"✅ Auto-Submit Issue"** button
3. System will:
   - 📤 Upload captured image to backend
   - 🗄️ Store issue in MongoDB with marked as **Live Detection**
   - 🔔 Trigger real-time notifications for other admins
   - ✅ Return confirmation with Issue ID

---

## 📊 Detection History
- Bottom section shows all detected issues **in this session**
- Displays **Issue Type, AI Label, Confidence %, and Timestamp**
- Useful for tracking multiple demonstrations

---

## 🎯 Civic Issues the System Recognizes

### ✅ Well-Detected Categories
- **Pothole**: Holes in asphalt/concrete, craters, pits
- **Garbage**: Trash, garbage dumps, plastic waste
- **Water Leak**: Leaks, water, floods, drains, puddles
- **Streetlight**: Lights, lamps, poles
- **Damaged Road**: Road surfaces, streets, concrete, sidewalks, pavements

### ❌ Non-Civic (Blocked)
- Human faces, people, selfies
- Personal/private images
- Non-infrastructure content

---

## 🎓 For Judges/Stakeholders Demonstrations

### Scenario 1: Pothole Detection
1. Point camera at a pothole or uneven road surface
2. Capture → System identifies "pothole" with ~80-95% confidence
3. Auto-submit → See issue appear in admin dashboard in real-time
4. **Show the speed and accuracy** → Impressive for judges!

### Scenario 2: Garbage/Waste Detection
1. Point at trash or garbage dump
2. Capture → System identifies "garbage" 
3. Auto-submit → Real-time issue creation
4. **Demonstrate civic problem detection capability**

### Scenario 3: Streetlight Issues
1. Point at broken/missing streetlight
2. Capture → Auto-detection and submission
3. **Show how non-expert users can report complex issues**

---

## ⚙️ Technical Details

### Technology Stack
- **Frontend**: React 18.2 + hooks
- **Camera**: Navigator.mediaDevices.getUserMedia API
- **AI Model**: TensorFlow.js + MobileNet v2
- **Image Validation**: Custom AI-detection algorithm + FaceDetector API
- **Backend**: Node.js + Express on port 5000
- **Database**: MongoDB (isLiveDetection flag marks auto-submissions)

### Data Sent on Auto-Submit
```json
{
  "issueType": "pothole",
  "title": "Live Detection: pothole (92% confidence)",
  "description": "🚨 LIVE ADMIN DETECTION\n[AI classification details]",
  "image": "[JPEG frame from capture]",
  "isLiveDetection": "true",
  "location": "Live Detection Demo",
  "latitude": 0,
  "longitude": 0
}
```

---

## 🔒 Security & Access Control
- ✅ **Admin-only access** - Requires valid admin login
- ✅ **Session verification** - Checks for adminToken in localStorage
- ✅ **Automatic redirect** - Non-admin users redirected to admin login
- ✅ **Backend authorization** - All submissions verified with Bearer token

---

## 🐛 Troubleshooting

### Camera Won't Start
- ✔️ Check browser camera permissions (allow camera in browser settings)
- ✔️ Make sure no other app is using the camera
- ✔️ Refresh page and try again
- ✔️ Use Chrome/Edge (best browser support)

### Analysis Says "No Civic Issue"
- The AI didn't recognize the object as civic infrastructure
- Try different angle/lighting
- Ensure object fills majority of frame
- Clear, well-lit photos work best

### AI-Generated Image Detected
- System blocked your image as possibly AI-generated or fake
- Use real, genuine photographs
- System has anti-spoofing measures enabled

### Issue Won't Submit
- ✔️ Check internet connection
- ✔️ Verify admin token hasn't expired (log in again)
- ✔️ Check browser console for specific error message
- ✔️ Ensure backend is running on port 5000

---

## 📱 Browser Support
- ✅ **Chrome/Chromium** (Best support)
- ✅ **Edge** (Full support)
- ✅ **Firefox** (Good support)
- ✅ **Safari** (Camera may need permissions setup)
- ❌ **Internet Explorer** (Not supported)

---

## 💡 Tips for Best Results

1. **Good Lighting**: Bright, natural light gives better AI results
2. **Clear View**: Make sure civic issue is clearly visible in frame
3. **Steady Hand**: Keep camera steady while capturing
4. **Fill Frame**: Let issue occupy significant portion of frame
5. **Real Photos**: Use genuine photographs, not screenshots
6. **Test Multiple**: Try different angles to find best detection

---

## 🎯 What Happens After Auto-Submit

1. **Immediate**: Issue appears in Admin Dashboard
2. **Real-time**: Other admins see the new issue instantly (via socket.io)
3. **Stored**: Issue saved to MongoDB with `isLiveDetection: true` flag
4. **Trackable**: Issue gets unique ID and full citizen dashboard visibility
5. **Actionable**: Can be assigned, tracked, and resolved like normal issues

---

## 📞 Support
For technical issues:
- Check browser console (F12) for error messages
- Ensure backend is running: `http://localhost:5000/api/issues`
- Verify MongoDB connection in backend logs
- Clear browser cache and try again

---

**Built for CivicSense AI - Empowering citizen infrastructure reporting** 🚀
