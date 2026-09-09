const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();

app.use(cors());
app.use(express.json());
    console.log("JWT_SECRET loaded:", process.env.JWT_SECRET);
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));
    const authRoutes = require("./routes/auth");
app.use("/api/auth", authRoutes);
  const skillRoutes = require("./routes/skills");
app.use("/api/skills", skillRoutes);

app.get("/", (req, res) => {
  res.send("InternZest Backend API is running 🚀");
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});