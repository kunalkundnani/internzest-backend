const express = require("express");
const mongoose = require("mongoose");
const Interview = require("../models/Interview");
const Application = require("../models/Application");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET all interviews for company
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can view interview schedules" });
    }

    const { status } = req.query;
    const query = { companyId: req.user.id };

    if (status && status !== "all") {
      query.status = status;
    }

    const interviews = await Interview.find(query).sort({ date: 1, time: 1 });
    res.json(interviews);
  } catch (err) {
    console.error("Fetch interviews error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// SCHEDULE an interview
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can schedule interviews" });
    }

    const {
      candidateName,
      candidateEmail,
      jobRole,
      date,
      time,
      duration = "45 mins",
      interviewType = "Technical",
      meetingLink,
      location,
      notes,
      applicationId,
    } = req.body;

    if (!candidateName || !date || !time) {
      return res.status(400).json({ message: "Candidate name, date, and time are required" });
    }

    let resolvedJobRole = jobRole;
    let studentId = null;

    if (applicationId && mongoose.Types.ObjectId.isValid(applicationId)) {
      const app = await Application.findById(applicationId);
      if (app) {
        resolvedJobRole = app.jobRole || resolvedJobRole;
        studentId = app.studentId || null;
        // Also update application status to Interview
        if (app.status !== "Interview") {
          app.status = "Interview";
          app.timeline.push({ stage: "Interview", date: new Date(), done: true });
          await app.save();
        }
      }
    }

    const interview = new Interview({
      companyId: req.user.id,
      applicationId: applicationId && mongoose.Types.ObjectId.isValid(applicationId) ? applicationId : null,
      studentId,
      candidateName: String(candidateName).trim(),
      candidateEmail: String(candidateEmail || "").trim(),
      jobRole: String(resolvedJobRole || "Software Intern").trim(),
      date: String(date).trim(),
      time: String(time).trim(),
      duration: String(duration).trim(),
      interviewType,
      meetingLink: String(meetingLink || "https://meet.google.com/xyz-internzest-demo").trim(),
      location: String(location || "Google Meet").trim(),
      notes: String(notes || "").trim(),
      status: "Scheduled",
    });

    await interview.save();

    // Create Notification for Company
    await Notification.create({
      userId: req.user.id,
      role: "company",
      title: "Interview Scheduled",
      message: `Interview scheduled with ${candidateName} for ${resolvedJobRole} on ${date} at ${time}.`,
      type: "interview",
    });

    // Create Notification for Student if applicable
    if (studentId) {
      await Notification.create({
        userId: studentId,
        role: "student",
        title: "Interview Invitation Received!",
        message: `${req.user.companyName || "Recruiter"} scheduled an interview with you for ${resolvedJobRole} on ${date} at ${time}.`,
        type: "interview",
      });
    }

    res.status(201).json({ message: "Interview scheduled successfully", interview });
  } catch (err) {
    console.error("Schedule interview error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// RESCHEDULE / EDIT interview
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can update interviews" });
    }

    const interview = await Interview.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!interview) {
      return res.status(404).json({ message: "Interview not found or unauthorized" });
    }

    const { date, time, duration, interviewType, meetingLink, location, notes, status } = req.body;

    if (date !== undefined) interview.date = String(date).trim();
    if (time !== undefined) interview.time = String(time).trim();
    if (duration !== undefined) interview.duration = String(duration).trim();
    if (interviewType !== undefined) interview.interviewType = interviewType;
    if (meetingLink !== undefined) interview.meetingLink = String(meetingLink).trim();
    if (location !== undefined) interview.location = String(location).trim();
    if (notes !== undefined) interview.notes = String(notes).trim();
    if (status !== undefined) interview.status = status;
    else if (date || time) interview.status = "Rescheduled";

    await interview.save();

    // Notification
    await Notification.create({
      userId: req.user.id,
      role: "company",
      title: "Interview Updated",
      message: `Interview with ${interview.candidateName} updated to ${interview.date} at ${interview.time}.`,
      type: "interview",
    });

    res.json({ message: "Interview updated successfully", interview });
  } catch (err) {
    console.error("Update interview error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CANCEL interview
router.patch("/:id/cancel", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can cancel interviews" });
    }

    const interview = await Interview.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!interview) {
      return res.status(404).json({ message: "Interview not found or unauthorized" });
    }

    interview.status = "Cancelled";
    await interview.save();

    await Notification.create({
      userId: req.user.id,
      role: "company",
      title: "Interview Cancelled",
      message: `Interview with ${interview.candidateName} on ${interview.date} was cancelled.`,
      type: "interview",
    });

    res.json({ message: "Interview cancelled", interview });
  } catch (err) {
    console.error("Cancel interview error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// MARK COMPLETED
router.patch("/:id/complete", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can mark interviews completed" });
    }

    const interview = await Interview.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!interview) {
      return res.status(404).json({ message: "Interview not found or unauthorized" });
    }

    interview.status = "Completed";
    await interview.save();

    res.json({ message: "Interview marked as completed", interview });
  } catch (err) {
    console.error("Complete interview error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
