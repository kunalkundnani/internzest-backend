const mongoose = require("mongoose");

const driveSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    companyName: { type: String, required: true, trim: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: ["Placement", "Internship", "Both"],
      default: "Placement",
      index: true,
    },
    role: { type: String, required: true, trim: true },
    packageOrStipend: { type: String, default: "8 - 12 LPA", trim: true },
    eligibleBranches: [{ type: String, trim: true }],
    minCgpa: { type: Number, default: 7.0, min: 0, max: 10 },
    driveDate: { type: String, required: true, trim: true }, // e.g. "2026-10-15"
    registrationDeadline: { type: String, required: true, trim: true }, // e.g. "2026-10-10"
    venue: { type: String, default: "Virtual / Campus Auditorium", trim: true },
    status: {
      type: String,
      enum: ["Upcoming", "Active", "Completed", "Cancelled"],
      default: "Upcoming",
      index: true,
    },
    description: { type: String, default: "", trim: true },
    registeredStudents: [
      {
        studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        studentName: { type: String, required: true },
        studentEmail: { type: String, required: true },
        studentBranch: { type: String, default: "" },
        studentCgpa: { type: Number, default: 8.0 },
        registeredAt: { type: Date, default: Date.now },
        status: { type: String, enum: ["Registered", "Shortlisted", "Selected", "Rejected"], default: "Registered" },
      },
    ],
    collegeName: { type: String, default: "Indian Institute of Information Technology Surat", trim: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Drive", driveSchema);
