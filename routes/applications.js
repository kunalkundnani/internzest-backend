const express = require("express");
const mongoose = require("mongoose");
const Application = require("../models/Application");
const Job = require("../models/Job");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
}

// GET all applications for the logged-in company
router.get("/company", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can view applicant lists" });
    }

    const { status, jobId, postType, search } = req.query;
    const query = { companyId: req.user.id };

    if (status && status !== "all") {
      query.status = status;
    }

    if (jobId && jobId !== "all") {
      if (mongoose.Types.ObjectId.isValid(jobId)) {
        query.jobId = jobId;
      }
    }

    if (postType && postType !== "all") {
      query.jobType = postType;
    }

    if (search) {
      const safeSearch = escapeRegex(String(search).trim());
      query.$or = [
        { studentName: { $regex: safeSearch, $options: "i" } },
        { studentCollege: { $regex: safeSearch, $options: "i" } },
        { jobRole: { $regex: safeSearch, $options: "i" } },
        { "studentSkills.name": { $regex: safeSearch, $options: "i" } },
      ];
    }

    const applications = await Application.find(query)
      .populate("jobId", "title role postType location workMode status")
      .sort({ createdAt: -1 });

    res.json(applications);
  } catch (err) {
    console.error("Fetch company applications error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET single application details
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid application ID" });
    }

    const app = await Application.findOne({
      _id: req.params.id,
      companyId: req.user.id,
    }).populate("jobId");

    if (!app) {
      return res.status(404).json({ message: "Application not found or unauthorized" });
    }

    res.json(app);
  } catch (err) {
    console.error("Get application error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// UPDATE application status
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can change application status" });
    }

    const { status } = req.body;
    const validStatuses = ["Applied", "Under Review", "Shortlisted", "Interview", "Selected", "Rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
    }

    const app = await Application.findOne({
      _id: req.params.id,
      companyId: req.user.id,
    });

    if (!app) {
      return res.status(404).json({ message: "Application not found or unauthorized" });
    }

    const oldStatus = app.status;
    app.status = status;

    // Append to timeline
    app.timeline.push({
      stage: status,
      date: new Date(),
      done: true,
    });

    await app.save();

    // Trigger notification for student if studentId exists
    if (app.studentId) {
      await Notification.create({
        userId: app.studentId,
        role: "student",
        title: `Application Status Updated: ${status}`,
        message: `${req.user.companyName || "The recruiter"} updated your application status for ${app.jobRole} to "${status}".`,
        type: "status_change",
        link: "/applications",
      });
    }

    // Trigger notification for company
    await Notification.create({
      userId: req.user.id,
      role: "company",
      title: `Candidate Status Updated: ${status}`,
      message: `You moved candidate ${app.studentName} for ${app.jobRole} from ${oldStatus} to ${status}.`,
      type: "status_change",
    });

    res.json({ message: `Application status updated to ${status}`, application: app });
  } catch (err) {
    console.error("Update application status error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// ADD recruiter note to application
router.post("/:id/notes", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can add notes" });
    }

    const { text } = req.body;
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: "Note text is required" });
    }

    const app = await Application.findOne({
      _id: req.params.id,
      companyId: req.user.id,
    });

    if (!app) {
      return res.status(404).json({ message: "Application not found or unauthorized" });
    }

    const newNote = {
      author: req.user.name || "Recruiter",
      text: String(text).trim(),
      createdAt: new Date(),
    };

    app.notes.push(newNote);
    await app.save();

    res.status(201).json({ message: "Note added successfully", notes: app.notes });
  } catch (err) {
    console.error("Add note error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
