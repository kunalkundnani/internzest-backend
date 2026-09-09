const express = require("express");
const Skill = require("../models/Skill");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET all skills of logged-in user
router.get("/", authMiddleware, async (req, res) => {
  try {
    const skills = await Skill.find({ userId: req.user.id }).sort({ createdAt: 1 });
    res.json(skills);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ADD a new skill
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { name, level, percent } = req.body;

    if (!name || !level || percent === undefined) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const existing = await Skill.findOne({
      userId: req.user.id,
      name: { $regex: `^${name}$`, $options: "i" },
    });

    if (existing) {
      return res.status(400).json({ message: "This skill is already added" });
    }

    const skill = new Skill({
      userId: req.user.id,
      name,
      level,
      percent,
      verified: false,
    });

    await skill.save();
    res.status(201).json(skill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// UPDATE a skill (after quiz verification)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { percent, verified, quizScore } = req.body;

    const skill = await Skill.findOne({ _id: req.params.id, userId: req.user.id });
    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }

    if (percent !== undefined) skill.percent = percent;
    if (verified !== undefined) skill.verified = verified;
    if (quizScore !== undefined) skill.quizScore = quizScore;

    await skill.save();
    res.json(skill);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE a skill
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const skill = await Skill.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!skill) {
      return res.status(404).json({ message: "Skill not found" });
    }
    res.json({ message: "Skill removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;