const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();
const path = require("path");
const fs = require("fs");
const http = require("http");
const { Server } = require("socket.io");
const webpush = require("web-push");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }
});

// Web Push VAPID Keys
webpush.setVapidDetails(
  'mailto:your-email@example.com', // Replace with your email
  'BNFv81Fm-YtTS4CRN9I2SLiDJ1lsM5ALR3qJ4SJCHgP2teBhGq_ds9HJbXoPxlBWfcQzCbTqHHMmXg50rhrWs9M', // Public Key
  'XK_y_Ju2VyGwBBfOyz7Vlpj0Y0bPURwBpQ_DTj0eyCk' // Private Key
);

app.use((req, res, next) => {
  req.io = io;
  next();
});


// ======================
// MIDDLEWARE
// ======================
app.use(cors({
  origin: "*",
  credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));


// ======================
// DATABASE CONNECTION
// ======================
if (!process.env.MONGODB_URI) {
  console.error("❌ MONGODB_URI not set in environment variables");
} else {
  mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("✅ MongoDB connected"))
    .catch(err => console.error("❌ MongoDB connection error:", err));
}


// ======================
// ROUTES
// ======================
app.use("/api/auth", require("./routes/authRoute"));
app.use("/api/issues", require("./routes/issueRoute"));


// ======================
// ROOT ROUTE (homepage)
// ======================
// Root route
app.get("/", (req, res) => {
  res.send("🚀 CivicSense Backend is running successfully");
});



// ======================
// HEALTH CHECK
// ======================
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    time: new Date()
  });
});

// ======================
// PUSH NOTIFICATION SUBSCRIPTION
// ======================
app.post('/api/subscribe', (req, res) => {
  const subscription = req.body;
  console.log('Subscription received:', subscription);

  // In a real app, save this to database
  // For now, just acknowledge
  res.status(201).json({ success: true });
});


// ======================
// UPLOADS STATIC FOLDER
// ======================
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use("/uploads", express.static(uploadsDir));


// ======================
// CLEAN OLD UPLOAD FILES
// ======================
function cleanupUploads(maxAgeDays = 30) {
  try {
    const files = fs.readdirSync(uploadsDir);
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    files.forEach(file => {
      const filePath = path.join(uploadsDir, file);
      try {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log("🗑 Deleted old upload:", file);
        }
      } catch (err) {
        console.error("Error checking file:", err.message);
      }
    });

  } catch (err) {
    console.error("Upload cleanup failed:", err.message);
  }
}

// run cleanup at startup
cleanupUploads(30);

// run daily
setInterval(() => cleanupUploads(30), 24 * 60 * 60 * 1000);


// ======================
// GLOBAL ERROR HANDLER
// ======================
app.use((err, req, res, next) => {
  console.error("🔥 Server error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});


// ======================
// SERVER START
// ======================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
