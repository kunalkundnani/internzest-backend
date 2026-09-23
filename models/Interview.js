const mongoose = require("mongoose");

const interviewSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    applicationId: { type: mongoose.Schema.Types.ObjectId, ref: "Application" },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    candidateName: { type: String, required: true, trim: true },
    candidateEmail: { type: String, required: true, trim: true },
    jobRole: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true }, // e.g. "2026-09-25"
    time: { type: String, required: true, trim: true }, // e.g. "11:00 AM"
    duration: { type: String, default: "45 mins", trim: true },
    interviewType: {
      type: String,
      enum: ["Technical", "HR", "Cultural Fit", "Final Round", "Video Call", "Onsite"],
      default: "Technical",
    },
    meetingLink: { type: String, default: "https://meet.google.com/xyz-internzest-demo", trim: true },
    location: { type: String, default: "Google Meet", trim: true },
    notes: { type: String, default: "", trim: true },
    status: {
      type: String,
      enum: ["Scheduled", "Completed", "Rescheduled", "Cancelled"],
      default: "Scheduled",
      index: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Interview", interviewSchema);
