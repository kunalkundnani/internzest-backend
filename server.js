const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config({ path: require("path").join(__dirname, ".env") });

const app = express();

// Security check on required environment variables
if (!process.env.JWT_SECRET) {
  console.warn("⚠️ Warning: JWT_SECRET is not set in environment variables!");
}
if (!process.env.MONGO_URI) {
  console.error("❌ Fatal: MONGO_URI is missing from environment variables!");
}

// CORS configuration: allow cross-origin requests from frontend
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err.message));

// Health check endpoint
app.get("/api/health", (req, res) => {
  const dbState = mongoose.connection.readyState;
  const dbStatusMap = {
    0: "disconnected",
    1: "connected",
    2: "connecting",
    3: "disconnecting",
  };

  res.json({
    status: "ok",
    service: "InternZest Backend API",
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    database: dbStatusMap[dbState] || "unknown",
  });
});

// Root welcome endpoint
app.get("/", (req, res) => {
  res.json({
    message: "InternZest Backend API is running 🚀",
    version: "1.0.0",
    docs: "/api/health",
  });
});

// Mount Routes
const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);

const skillRoutes = require("./routes/skills");
app.use("/api/skills", skillRoutes);

const jobRoutes = require("./routes/jobs");
app.use("/api/jobs", jobRoutes);

// Mount Company & Recruitment Routes
const companyRoutes = require("./routes/company");
app.use("/api/company", companyRoutes);

const applicationRoutes = require("./routes/applications");
app.use("/api/applications", applicationRoutes);

const candidateRoutes = require("./routes/candidates");
app.use("/api/candidates", candidateRoutes);

const interviewRoutes = require("./routes/interviews");
app.use("/api/interviews", interviewRoutes);

const messageRoutes = require("./routes/messages");
app.use("/api/messages", messageRoutes);

const notificationRoutes = require("./routes/notifications");
app.use("/api/notifications", notificationRoutes);

const collegeRoutes = require("./routes/college");
app.use("/api/college", collegeRoutes);

// Global 404 handler for unmatched routes
app.use((req, res) => {
  res.status(404).json({
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled Error:", err);
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    message: err.message || "Internal server error",
  });
});

const PORT = process.env.PORT || 5000;
const server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nGracefully shutting down...");
  server.close(() => {
    mongoose.connection.close(false).then(() => {
      console.log("MongoDB connection closed.");
      process.exit(0);
    });
  });
});

module.exports = app;