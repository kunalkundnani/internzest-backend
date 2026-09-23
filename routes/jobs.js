const express = require("express");
const mongoose = require("mongoose");
const Job = require("../models/Job");
const Application = require("../models/Application");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^$\{\}()|[\]\\]/g, "\\$&");
}

// GET all active jobs (for public / student view)
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { search, type, location, postType } = req.query;
    const query = { status: "active" };

    if (postType) {
      query.postType = postType;
    }

    if (search) {
      const safeSearch = escapeRegex(String(search).trim());
      query.$or = [
        { role: { $regex: safeSearch, $options: "i" } },
        { title: { $regex: safeSearch, $options: "i" } },
        { companyName: { $regex: safeSearch, $options: "i" } },
        { description: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (type) {
      query.workMode = { $regex: `^${escapeRegex(String(type).trim())}$`, $options: "i" };
    }

    if (location) {
      query.location = { $regex: escapeRegex(String(location).trim()), $options: "i" };
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (err) {
    console.error("Fetch jobs error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET postings for the logged-in company (with filters)
router.get("/my", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can view their postings" });
    }

    const { postType, status, search } = req.query;
    const query = { companyId: req.user.id };

    if (postType && postType !== "all") {
      query.postType = postType;
    }

    if (status && status !== "all") {
      query.status = status;
    }

    if (search) {
      const safeSearch = escapeRegex(String(search).trim());
      query.$or = [
        { role: { $regex: safeSearch, $options: "i" } },
        { title: { $regex: safeSearch, $options: "i" } },
        { location: { $regex: safeSearch, $options: "i" } },
      ];
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 });

    // Attach real live application counts for each job
    const jobIds = jobs.map((j) => j._id);
    const appCounts = await Application.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);

    const countMap = {};
    appCounts.forEach((ac) => {
      countMap[String(ac._id)] = ac.count;
    });

    const enriched = jobs.map((j) => {
      const doc = j.toObject();
      doc.applicationsCount = countMap[String(j._id)] || 0;
      return doc;
    });

    res.json(enriched);
  } catch (err) {
    console.error("Fetch company jobs error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET single job by ID
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid job ID format" });
    }

    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Job not found" });
    }

    const doc = job.toObject();
    const count = await Application.countDocuments({ jobId: job._id });
    doc.applicationsCount = count;

    res.json(doc);
  } catch (err) {
    console.error("Get job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CREATE a job or internship (company only)
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can post jobs/internships" });
    }

    const {
      companyName,
      role,
      title,
      postType = "internship",
      department,
      type,
      workMode,
      employmentType,
      experience,
      location,
      stipend,
      salary,
      duration,
      startDate,
      applicationDeadline,
      openings,
      eligibility,
      description,
      responsibilities,
      requirements,
      benefits,
      requiredSkills,
      status = "active",
    } = req.body;

    const jobTitle = String(title || role || "").trim();
    const resolvedCompany = String(companyName || req.user.companyName || req.user.name || "Company").trim();

    if (!jobTitle) {
      return res.status(400).json({ message: "Title or Role is required" });
    }

    let formattedSkills = [];
    if (Array.isArray(requiredSkills)) {
      formattedSkills = requiredSkills
        .filter((s) => s && (typeof s === "string" || (typeof s === "object" && s.name)))
        .map((s) => {
          if (typeof s === "string") return { name: s.trim(), minPercent: 60 };
          return {
            name: String(s.name).trim(),
            minPercent: Math.max(0, Math.min(100, Number(s.minPercent) || 50)),
          };
        });
    }

    const formatList = (val) => {
      if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
      if (typeof val === "string") return val.split("\n").map((v) => v.trim()).filter(Boolean);
      return [];
    };

    const newJob = new Job({
      companyId: req.user.id,
      companyName: resolvedCompany,
      role: jobTitle,
      title: jobTitle,
      postType: postType === "job" ? "job" : "internship",
      department: department ? String(department).trim() : "General",
      type: type ? String(type).trim() : postType === "job" ? "Full-time" : "Internship",
      workMode: workMode ? String(workMode).trim() : "Hybrid",
      employmentType: employmentType ? String(employmentType).trim() : "Full-time",
      experience: experience ? String(experience).trim() : "Entry Level",
      location: location ? String(location).trim() : "Remote",
      stipend: stipend ? String(stipend).trim() : "",
      salary: salary ? String(salary).trim() : "",
      duration: duration ? String(duration).trim() : "3 Months",
      startDate: startDate ? String(startDate).trim() : "Immediate",
      applicationDeadline: applicationDeadline ? String(applicationDeadline).trim() : "",
      openings: Number(openings) > 0 ? Number(openings) : 1,
      eligibility: eligibility ? String(eligibility).trim() : "",
      description: description ? String(description).trim() : "",
      responsibilities: formatList(responsibilities),
      requirements: formatList(requirements),
      benefits: formatList(benefits),
      requiredSkills: formattedSkills,
      status: status === "draft" ? "draft" : "active",
      isActive: status !== "draft",
    });

    await newJob.save();
    res.status(201).json(newJob);
  } catch (err) {
    console.error("Create job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// UPDATE a job or internship
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can update postings" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const job = await Job.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!job) {
      return res.status(404).json({ message: "Posting not found or unauthorized" });
    }

    const b = req.body;
    if (b.title !== undefined || b.role !== undefined) {
      const t = String(b.title || b.role || "").trim();
      if (!t) return res.status(400).json({ message: "Title cannot be empty" });
      job.title = t;
      job.role = t;
    }
    if (b.postType !== undefined) job.postType = b.postType;
    if (b.department !== undefined) job.department = String(b.department).trim();
    if (b.workMode !== undefined) job.workMode = String(b.workMode).trim();
    if (b.employmentType !== undefined) job.employmentType = String(b.employmentType).trim();
    if (b.experience !== undefined) job.experience = String(b.experience).trim();
    if (b.location !== undefined) job.location = String(b.location).trim();
    if (b.stipend !== undefined) job.stipend = String(b.stipend).trim();
    if (b.salary !== undefined) job.salary = String(b.salary).trim();
    if (b.duration !== undefined) job.duration = String(b.duration).trim();
    if (b.startDate !== undefined) job.startDate = String(b.startDate).trim();
    if (b.applicationDeadline !== undefined) job.applicationDeadline = String(b.applicationDeadline).trim();
    if (b.openings !== undefined) job.openings = Number(b.openings) || 1;
    if (b.eligibility !== undefined) job.eligibility = String(b.eligibility).trim();
    if (b.description !== undefined) job.description = String(b.description).trim();
    if (b.status !== undefined) {
      job.status = b.status;
      job.isActive = b.status === "active";
    }

    const formatList = (val) => {
      if (Array.isArray(val)) return val.map((v) => String(v).trim()).filter(Boolean);
      if (typeof val === "string") return val.split("\n").map((v) => v.trim()).filter(Boolean);
      return [];
    };

    if (b.responsibilities !== undefined) job.responsibilities = formatList(b.responsibilities);
    if (b.requirements !== undefined) job.requirements = formatList(b.requirements);
    if (b.benefits !== undefined) job.benefits = formatList(b.benefits);

    if (b.requiredSkills !== undefined && Array.isArray(b.requiredSkills)) {
      job.requiredSkills = b.requiredSkills
        .filter((s) => s && (typeof s === "string" || (typeof s === "object" && s.name)))
        .map((s) => {
          if (typeof s === "string") return { name: s.trim(), minPercent: 60 };
          return {
            name: String(s.name).trim(),
            minPercent: Math.max(0, Math.min(100, Number(s.minPercent) || 50)),
          };
        });
    }

    await job.save();
    res.json(job);
  } catch (err) {
    console.error("Update job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// STATUS TOGGLE: close, reopen, publish
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can modify status" });
    }

    const { status } = req.body;
    if (!["active", "draft", "closed", "expired"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const job = await Job.findOne({ _id: req.params.id, companyId: req.user.id });
    if (!job) {
      return res.status(404).json({ message: "Posting not found or unauthorized" });
    }

    job.status = status;
    job.isActive = status === "active";
    await job.save();

    res.json({ message: `Status changed to ${status}`, job });
  } catch (err) {
    console.error("Toggle status error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE a posting
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can delete postings" });
    }

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid ID format" });
    }

    const job = await Job.findOneAndDelete({ _id: req.params.id, companyId: req.user.id });
    if (!job) {
      return res.status(404).json({ message: "Posting not found or unauthorized" });
    }

    res.json({ message: "Posting deleted successfully", id: req.params.id });
  } catch (err) {
    console.error("Delete job error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
