const express = require("express");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
}

// GET candidates talent pool
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can browse candidates" });
    }

    const { search, skill, minMatch, status } = req.query;

    // Build candidates from Applications for this company, plus student profiles
    const query = { companyId: req.user.id };

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      const safeSearch = escapeRegex(String(search).trim());
      query.$or = [
        { studentName: { $regex: safeSearch, $options: "i" } },
        { studentCollege: { $regex: safeSearch, $options: "i" } },
        { studentBranch: { $regex: safeSearch, $options: "i" } },
        { "studentSkills.name": { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (skill) {
      query["studentSkills.name"] = { $regex: escapeRegex(String(skill).trim()), $options: "i" };
    }

    if (minMatch) {
      query.matchScore = { $gte: Number(minMatch) };
    }

    const apps = await Application.find(query).sort({ matchScore: -1, createdAt: -1 });

    res.json(apps);
  } catch (err) {
    console.error("Candidates fetch error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET candidate details
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid candidate ID format" });
    }

    const app = await Application.findOne({
      _id: req.params.id,
      companyId: req.user.id,
    }).populate("jobId");

    if (!app) {
      return res.status(404).json({ message: "Candidate record not found" });
    }

    res.json(app);
  } catch (err) {
    console.error("Candidate details error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
