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

webpush.setVapidDetails(
  process.env.VAPID_EMAIL || "mailto:admin@civicsense.in",
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
  console.warn("VAPID keys missing - webpush disabled");
}

app.use((req, res, next) => {
  req.io = io;
  next();
});

app.use(cors({ origin: "*" }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ limit: "10mb", extended: true }));

const connectToDatabase = async () => {
  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    family: 4,
    maxPoolSize: 10,
    retryWrites: true,
    w: "majority"
  });

  console.log("MongoDB connected");
  await mongoose.connection.db.admin().ping();
  console.log("MongoDB ping successful");
};

const scheduleReconnect = () => {
  setTimeout(async () => {
    try {
      await connectToDatabase();
    } catch (err) {
      console.error("MongoDB reconnect failed:", err.message);
      scheduleReconnect();
    }
  }, 15000);
};

if (!process.env.MONGODB_URI) {
  console.error("MONGODB_URI not set in environment variables");
} else {
  connectToDatabase().catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    console.error("Fix: Check .env MONGODB_URI, Atlas whitelist, network/DNS");
    console.error("The server will keep retrying instead of exiting.");
    scheduleReconnect();
  });
}

app.use("/api/auth", require("./routes/authRoute"));
app.use("/api/issues", require("./routes/issueRoute"));

app.get("/", (req, res) => {
  res.send("CivicSense Backend is running successfully");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
    time: new Date(),
    databaseConnected: mongoose.connection.readyState === 1
  });
});

app.post("/api/subscribe", (req, res) => {
  const subscription = req.body;
  console.log("Subscription received:", subscription);
  res.status(201).json({ success: true });
});

const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}

app.use("/uploads", express.static(uploadsDir));

function cleanupUploads(maxAgeDays = 30) {
  try {
    const files = fs.readdirSync(uploadsDir);
    const now = Date.now();
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;

    files.forEach((file) => {
      const filePath = path.join(uploadsDir, file);

      try {
        const stat = fs.statSync(filePath);

        if (now - stat.mtimeMs > maxAge) {
          fs.unlinkSync(filePath);
          console.log("Deleted old upload:", file);
        }
      } catch (err) {
        console.error("Error checking file:", err.message);
      }
    });
  } catch (err) {
    console.error("Upload cleanup failed:", err.message);
  }
}

cleanupUploads(30);
setInterval(() => cleanupUploads(30), 24 * 60 * 60 * 1000);

app.use((err, req, res, next) => {
  console.error("Server error:", err.stack);
  res.status(500).json({
    success: false,
    message: "Internal server error"
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
