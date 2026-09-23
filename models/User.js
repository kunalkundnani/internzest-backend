const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ["student", "company", "college"], required: true },
    college: { type: String, default: "", trim: true },
    branch: { type: String, default: "", trim: true },
    year: { type: String, default: "", trim: true },
    bio: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    location: { type: String, default: "", trim: true },
    github: { type: String, default: "", trim: true },
    linkedin: { type: String, default: "", trim: true },
    avatar: { type: String, default: "" },

    // Student specific academic fields
    rollNo: { type: String, default: "", trim: true },
    cgpa: { type: Number, default: 8.0, min: 0, max: 10 },
    readinessScore: { type: Number, default: 75, min: 0, max: 100 },
    placedStatus: {
      type: String,
      enum: ["Seeking", "Shortlisted", "Placed", "Opted Out"],
      default: "Seeking",
      index: true,
    },
    placedCompany: { type: String, default: "", trim: true },
    packageOffered: { type: String, default: "", trim: true },
    isActive: { type: Boolean, default: true, index: true },

    // College specific profile fields
    collegeName: { type: String, default: "", trim: true },
    collegeCode: { type: String, default: "", trim: true }, // AISHE or University code
    affiliation: { type: String, default: "Autonomous / Central University", trim: true },
    tpoName: { type: String, default: "Prof. Rajesh Sharma", trim: true },
    tpoDesignation: { type: String, default: "Head - Training & Placement Cell", trim: true },
    tpoEmail: { type: String, default: "", trim: true },
    tpoPhone: { type: String, default: "+91 98765 12340", trim: true },
    accreditation: { type: String, default: "NAAC A++ | NIRF Top 50", trim: true },
    establishedYear: { type: String, default: "2017", trim: true },
    departments: [{ type: String, trim: true }],
    address: { type: String, default: "", trim: true },
    banner: { type: String, default: "" },
    verified: { type: Boolean, default: true },

    // Company specific profile fields
    companyName: { type: String, default: "", trim: true },
    designation: { type: String, default: "HR Manager", trim: true },
    companyLogo: { type: String, default: "" },
    website: { type: String, default: "", trim: true },
    industry: { type: String, default: "Information Technology", trim: true },
    companySize: { type: String, default: "50-200 employees", trim: true },
    foundedYear: { type: String, default: "2018", trim: true },
    about: { type: String, default: "", trim: true },
    contactEmail: { type: String, default: "", trim: true },
    contactPhone: { type: String, default: "", trim: true },
    socialLinks: {
      linkedin: { type: String, default: "" },
      twitter: { type: String, default: "" },
      website: { type: String, default: "" },
      github: { type: String, default: "" },
    },
    preferences: {
      emailAlerts: { type: Boolean, default: true },
      newApplicationAlert: { type: Boolean, default: true },
      interviewReminders: { type: Boolean, default: true },
      weeklyDigest: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
