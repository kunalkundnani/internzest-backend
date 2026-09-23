const mongoose = require("mongoose");

const jobSchema = new mongoose.Schema(
  {
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    companyName: { type: String, required: true, trim: true },
    postType: { type: String, enum: ["job", "internship"], default: "internship", index: true },
    role: { type: String, required: true, trim: true },
    title: { type: String, default: "", trim: true },
    department: { type: String, default: "Engineering", trim: true },
    type: { type: String, default: "Internship", trim: true },
    workMode: { type: String, enum: ["Remote", "On-site", "Hybrid"], default: "Hybrid", trim: true },
    employmentType: { type: String, default: "Full-time", trim: true },
    experience: { type: String, default: "Entry Level", trim: true },
    location: { type: String, default: "Bangalore, India", trim: true },
    stipend: { type: String, default: "", trim: true },
    salary: { type: String, default: "", trim: true },
    duration: { type: String, default: "3 Months", trim: true },
    startDate: { type: String, default: "Immediate", trim: true },
    applicationDeadline: { type: String, default: "", trim: true },
    openings: { type: Number, default: 1, min: 1 },
    eligibility: { type: String, default: "Open to all relevant branches", trim: true },
    description: { type: String, default: "", trim: true },
    responsibilities: [{ type: String, trim: true }],
    requirements: [{ type: String, trim: true }],
    benefits: [{ type: String, trim: true }],
    requiredSkills: [
      {
        name: { type: String, required: true, trim: true },
        minPercent: { type: Number, required: true, min: 0, max: 100 },
      },
    ],
    status: { type: String, enum: ["active", "draft", "closed", "expired"], default: "active", index: true },
    isActive: { type: Boolean, default: true, index: true },
    viewsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Keep title & role in sync
jobSchema.pre("save", function () {
  if (!this.title && this.role) this.title = this.role;
  if (!this.role && this.title) this.role = this.title;
  this.isActive = this.status === "active";
});

module.exports = mongoose.model("Job", jobSchema);
