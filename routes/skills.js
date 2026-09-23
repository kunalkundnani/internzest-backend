const express = require("express");
const mongoose = require("mongoose");
const Skill = require("../models/Skill");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// Helper to escape regex special characters
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// GET all skills of logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const skills = await Skill.find({ userId: req.user.id }).sort({ createdAt: 1 });
    res.json(skills);
  } catch (err) {
    console.error("Fetch skills error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET single skill by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid skill ID format" });
    }

    const skill = await Skill.findOne({ _id: req.params.id, userId: req.user.id });
    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    res.json(skill);
  } catch (err) {
    console.error("Get skill error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ADD a new skill
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, level, percent } = req.body;

    if (!name || !level || percent === undefined || percent === null) {
      return res.status(400).json({ message: "Name, level, and percent are required" });
    }

    const trimmedName = String(name).trim();
    const trimmedLevel = String(level).trim();
    const numPercent = Number(percent);

    if (!trimmedName) {
      return res.status(400).json({ message: "Skill name cannot be empty" });
    }

    if (isNaN(numPercent) || numPercent < 0 || numPercent > 100) {
      return res.status(400).json({ message: "Percent must be a number between 0 and 100" });
    }

    const safeRegex = new RegExp(`^${escapeRegex(trimmedName)}$`, "i");
    const existing = await Skill.findOne({
      userId: req.user.id,
      name: safeRegex,
    });

    if (existing) {
      return res.status(400).json({ message: "This skill is already added" });
    }

    const skill = new Skill({
      userId: req.user.id,
      name: trimmedName,
      level: trimmedLevel || "Beginner",
      percent: Math.round(numPercent),
      verified: false,
    });

    await skill.save();
    res.status(201).json(skill);
  } catch (err) {
    console.error("Create skill error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// UPDATE a skill (percent, verified, quizScore, level, name)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid skill ID format" });
    }

    const { name, level, percent, verified, quizScore } = req.body;

    const skill = await Skill.findOne({ _id: req.params.id, userId: req.user.id });
    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) return res.status(400).json({ message: "Skill name cannot be empty" });

      // Check if renaming causes collision with another existing skill
      const safeRegex = new RegExp(`^${escapeRegex(trimmedName)}$`, "i");
      const collision = await Skill.findOne({
        userId: req.user.id,
        _id: { $ne: skill._id },
        name: safeRegex,
      });
      if (collision) {
        return res.status(400).json({ message: "A skill with this name already exists" });
      }
      skill.name = trimmedName;
    }

    if (level !== undefined) {
      skill.level = String(level).trim();
    }

    if (percent !== undefined) {
      const numPercent = Number(percent);
      if (isNaN(numPercent) || numPercent < 0 || numPercent > 100) {
        return res.status(400).json({ message: "Percent must be a number between 0 and 100" });
      }
      skill.percent = Math.round(numPercent);
    }

    if (verified !== undefined) {
      skill.verified = Boolean(verified);
    }

    if (quizScore !== undefined) {
      if (quizScore === null) {
        skill.quizScore = null;
      } else {
        const numScore = Number(quizScore);
        if (isNaN(numScore) || numScore < 0 || numScore > 100) {
          return res.status(400).json({ message: "Quiz score must be a number between 0 and 100" });
        }
        skill.quizScore = Math.round(numScore);
      }
    }

    await skill.save();
    res.json(skill);
  } catch (err) {
    console.error("Update skill error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE a skill
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid skill ID format" });
    }

    const skill = await Skill.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }
    res.json({ message: "Skill removed successfully", id: req.params.id });
  } catch (err) {
    console.error("Delete skill error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;