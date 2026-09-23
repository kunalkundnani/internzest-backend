const mongoose = require("mongoose");

const applicationSchema = new mongoose.Schema(
  {
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    studentName: { type: String, required: true, trim: true },
    studentEmail: { type: String, required: true, trim: true },
    studentCollege: { type: String, default: "Shri Dhanwantari Ayurvedic College", trim: true },
    studentBranch: { type: String, default: "BAMS", trim: true },
    studentYear: { type: String, default: "Final Year", trim: true },
    studentPhone: { type: String, default: "+91 98765 43210", trim: true },
    studentBio: { type: String, default: "", trim: true },
    studentSkills: [
      {
        name: { type: String, trim: true },
        level: { type: String, default: "Intermediate" },
        percent: { type: Number, default: 70 },
        verified: { type: Boolean, default: false },
      },
    ],
    resumeUrl: { type: String, default: "https://internzest.com/resumes/sample-candidate.pdf" },
    coverLetter: { type: String, default: "" },
    portfolioUrl: { type: String, default: "" },
    jobRole: { type: String, required: true, trim: true },
    jobType: { type: String, enum: ["job", "internship"], default: "internship" },
    status: {
      type: String,
      enum: ["Applied", "Under Review", "Shortlisted", "Interview", "Selected", "Rejected"],
      default: "Applied",
      index: true,
    },
    matchScore: { type: Number, default: 85, min: 0, max: 100 },
    appliedDate: { type: Date, default: Date.now },
    notes: [
      {
        author: { type: String, default: "Recruiter" },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    timeline: [
      {
        stage: { type: String, required: true },
        date: { type: Date, default: Date.now },
        done: { type: Boolean, default: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Application", applicationSchema);
