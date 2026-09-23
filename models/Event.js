const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    eventType: {
      type: String,
      enum: ["Workshop", "Seminar", "Mock Interview", "Hackathon", "Resume Clinic", "Guest Lecture"],
      default: "Workshop",
      index: true,
    },
    date: { type: String, required: true, trim: true }, // e.g. "2026-10-05"
    time: { type: String, required: true, trim: true }, // e.g. "10:00 AM - 1:00 PM"
    venue: { type: String, default: "Main Seminar Hall / Zoom", trim: true },
    speakerName: { type: String, default: "Industry Expert", trim: true },
    speakerCompany: { type: String, default: "Tech Innovators", trim: true },
    targetAudience: { type: String, default: "3rd & Final Year Students", trim: true },
    capacity: { type: Number, default: 150 },
    registeredCount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["Scheduled", "Ongoing", "Completed", "Cancelled"],
      default: "Scheduled",
      index: true,
    },
    description: { type: String, default: "", trim: true },
    collegeName: { type: String, default: "Indian Institute of Information Technology Surat", trim: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Event", eventSchema);
