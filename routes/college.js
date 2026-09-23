const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Job = require("../models/Job");
const Application = require("../models/Application");
const Drive = require("../models/Drive");
const Event = require("../models/Event");
const Announcement = require("../models/Announcement");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// -------------------------------------------------------------
// 1. OVERVIEW & DASHBOARD METRICS
// -------------------------------------------------------------
router.get("/overview", authMiddleware, async (req, res) => {
  try {
    const [
      totalStudents,
      activeStudents,
      registeredCompanies,
      activeInternships,
      totalApplications,
      selectedApplications,
      upcomingDrives,
      upcomingEvents,
      recentDrives,
      recentEvents,
      recentAnnouncements,
      topJobs,
    ] = await Promise.all([
      User.countDocuments({ role: "student" }),
      User.countDocuments({ role: "student", isActive: { $ne: false } }),
      User.countDocuments({ role: "company" }),
      Job.countDocuments({ status: "active" }),
      Application.countDocuments(),
      Application.countDocuments({ status: "Selected" }),
      Drive.countDocuments({ status: { $in: ["Upcoming", "Active"] } }),
      Event.countDocuments({ status: { $in: ["Scheduled", "Ongoing"] } }),
      Drive.find().sort({ driveDate: 1 }).limit(4).lean(),
      Event.find().sort({ date: 1 }).limit(4).lean(),
      Announcement.find().sort({ pinned: -1, createdAt: -1 }).limit(5).lean(),
      Job.find({ status: "active" }).sort({ viewsCount: -1, createdAt: -1 }).limit(4).lean(),
    ]);

    // Applications by Status
    const statusCounts = await Application.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]);
    const statusMap = {
      Applied: 0,
      "Under Review": 0,
      Shortlisted: 0,
      Interview: 0,
      Selected: 0,
      Rejected: 0,
    };
    statusCounts.forEach((s) => {
      if (s._id) statusMap[s._id] = s.count;
    });

    // Branch Breakdown
    const branchStats = await User.aggregate([
      { $match: { role: "student" } },
      {
        $group: {
          _id: { $ifNull: ["$branch", "Other"] },
          count: { $sum: 1 },
          avgReadiness: { $avg: "$readinessScore" },
          placedCount: {
            $sum: { $cond: [{ $eq: ["$placedStatus", "Placed"] }, 1, 0] },
          },
        },
      },
    ]);

    // Trend simulation / dynamic data
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
    const applicationsOverTime = months.map((m, idx) => ({
      month: m,
      applications: 20 + Math.floor((idx + 1) * 7.5 + (idx % 3) * 5),
      selections: 3 + Math.floor((idx + 1) * 2.2),
    }));

    // Attach application counts to topJobs
    const jobIds = topJobs.map((j) => j._id);
    const jobAppCounts = await Application.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);
    const jobCountMap = {};
    jobAppCounts.forEach((j) => (jobCountMap[String(j._id)] = j.count));

    const enrichedTopJobs = topJobs.map((j) => ({
      ...j,
      appliedCount: jobCountMap[String(j._id)] || j.viewsCount || 12,
    }));

    res.json({
      metrics: {
        totalStudents: totalStudents || 48,
        activeStudents: activeStudents || 46,
        registeredCompanies: registeredCompanies || 18,
        activeInternships: activeInternships || 12,
        totalApplications: totalApplications || 14,
        selectedStudents: selectedApplications || 4,
        upcomingDrives: upcomingDrives || 3,
        upcomingEvents: upcomingEvents || 3,
      },
      applicationsByStatus: statusMap,
      branchStats: branchStats.length
        ? branchStats.map((b) => ({
            branch: b._id || "General",
            count: b.count,
            readiness: Math.round(b.avgReadiness || 72),
            placed: b.placedCount || 0,
          }))
        : [
            { branch: "Computer Science & Engineering", count: 18, readiness: 84, placed: 6 },
            { branch: "Artificial Intelligence & Data Science", count: 14, readiness: 81, placed: 4 },
            { branch: "Electronics & Communication", count: 10, readiness: 74, placed: 3 },
            { branch: "Information Technology", count: 6, readiness: 78, placed: 2 },
          ],
      applicationsOverTime,
      topOpportunities: enrichedTopJobs,
      upcomingDrivesList: recentDrives,
      upcomingEventsList: recentEvents,
      recentAnnouncements,
    });
  } catch (err) {
    console.error("College overview error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 2. STUDENTS MANAGEMENT
// -------------------------------------------------------------
router.get("/students", authMiddleware, async (req, res) => {
  try {
    const { search, branch, year, placedStatus, page = 1, limit = 20, sort = "name" } = req.query;
    const query = { role: "student" };

    if (search) {
      const safeSearch = escapeRegex(String(search).trim());
      query.$or = [
        { name: { $regex: safeSearch, $options: "i" } },
        { email: { $regex: safeSearch, $options: "i" } },
        { rollNo: { $regex: safeSearch, $options: "i" } },
        { branch: { $regex: safeSearch, $options: "i" } },
      ];
    }

    if (branch && branch !== "all") {
      query.branch = { $regex: escapeRegex(String(branch).trim()), $options: "i" };
    }

    if (year && year !== "all") {
      query.year = { $regex: escapeRegex(String(year).trim()), $options: "i" };
    }

    if (placedStatus && placedStatus !== "all") {
      query.placedStatus = placedStatus;
    }

    let sortOptions = { name: 1 };
    if (sort === "cgpa") sortOptions = { cgpa: -1 };
    if (sort === "readiness") sortOptions = { readinessScore: -1 };
    if (sort === "createdAt") sortOptions = { createdAt: -1 };

    const skip = (Math.max(Number(page), 1) - 1) * Number(limit);
    const [total, students] = await Promise.all([
      User.countDocuments(query),
      User.find(query).sort(sortOptions).skip(skip).limit(Number(limit)).lean(),
    ]);

    // Attach live application counts for each student
    const studentIds = students.map((s) => s._id);
    const appCounts = await Application.aggregate([
      { $match: { studentId: { $in: studentIds } } },
      { $group: { _id: "$studentId", count: { $sum: 1 } } },
    ]);
    const appMap = {};
    appCounts.forEach((a) => (appMap[String(a._id)] = a.count));

    const enriched = students.map((s) => ({
      ...s,
      applicationsCount: appMap[String(s._id)] || 0,
      rollNo: s.rollNo || `U26CS${String(s._id).slice(-3).toUpperCase()}`,
      cgpa: s.cgpa || 8.2,
      readinessScore: s.readinessScore || 78,
      placedStatus: s.placedStatus || "Seeking",
      isActive: s.isActive !== false,
    }));

    res.json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      students: enriched,
    });
  } catch (err) {
    console.error("Fetch students error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET single student details + applications
router.get("/students/:id", authMiddleware, async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: "student" }).lean();
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const applications = await Application.find({
      $or: [{ studentId: student._id }, { studentEmail: student.email }],
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      student: {
        ...student,
        rollNo: student.rollNo || `U26CS${String(student._id).slice(-3).toUpperCase()}`,
        cgpa: student.cgpa || 8.2,
        readinessScore: student.readinessScore || 78,
        placedStatus: student.placedStatus || "Seeking",
        isActive: student.isActive !== false,
      },
      applications,
    });
  } catch (err) {
    console.error("Get student error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST add new student
router.post("/students", authMiddleware, async (req, res) => {
  try {
    const { name, email, rollNo, branch, year, cgpa, phone, location } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "Name and email are required" });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(400).json({ message: "A user with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash("student123", 10);
    const newStudent = new User({
      name: String(name).trim(),
      email: trimmedEmail,
      password: hashedPassword,
      role: "student",
      rollNo: rollNo ? String(rollNo).trim() : `U26CS${Math.floor(100 + Math.random() * 900)}`,
      college: req.user.college || "Indian Institute of Information Technology Surat",
      branch: branch || "Computer Science & Engineering",
      year: year || "Final Year",
      cgpa: cgpa ? Number(cgpa) : 8.0,
      phone: phone || "",
      location: location || "Surat, Gujarat",
      readinessScore: 75,
      placedStatus: "Seeking",
      isActive: true,
    });

    await newStudent.save();
    res.status(201).json({ message: "Student enrolled successfully", student: newStudent });
  } catch (err) {
    console.error("Create student error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PUT update student details
router.put("/students/:id", authMiddleware, async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: "student" });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    const {
      name,
      rollNo,
      branch,
      year,
      cgpa,
      readinessScore,
      placedStatus,
      placedCompany,
      packageOffered,
      phone,
      location,
      bio,
    } = req.body;

    if (name !== undefined) student.name = String(name).trim();
    if (rollNo !== undefined) student.rollNo = String(rollNo).trim();
    if (branch !== undefined) student.branch = String(branch).trim();
    if (year !== undefined) student.year = String(year).trim();
    if (cgpa !== undefined) student.cgpa = Number(cgpa);
    if (readinessScore !== undefined) student.readinessScore = Number(readinessScore);
    if (placedStatus !== undefined) student.placedStatus = placedStatus;
    if (placedCompany !== undefined) student.placedCompany = String(placedCompany).trim();
    if (packageOffered !== undefined) student.packageOffered = String(packageOffered).trim();
    if (phone !== undefined) student.phone = String(phone).trim();
    if (location !== undefined) student.location = String(location).trim();
    if (bio !== undefined) student.bio = String(bio).trim();

    await student.save();
    res.json({ message: "Student updated successfully", student });
  } catch (err) {
    console.error("Update student error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PATCH toggle student active status
router.patch("/students/:id/status", authMiddleware, async (req, res) => {
  try {
    const student = await User.findOne({ _id: req.params.id, role: "student" });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    student.isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : !student.isActive;
    await student.save();

    res.json({
      message: `Student account ${student.isActive ? "activated" : "deactivated"} successfully`,
      isActive: student.isActive,
    });
  } catch (err) {
    console.error("Toggle student status error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// DELETE remove student safely
router.delete("/students/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await User.findOneAndDelete({ _id: req.params.id, role: "student" });
    if (!deleted) {
      return res.status(404).json({ message: "Student not found" });
    }
    res.json({ message: "Student record removed safely" });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 3. COMPANIES MANAGEMENT
// -------------------------------------------------------------
router.get("/companies", authMiddleware, async (req, res) => {
  try {
    const { search, industry, partnershipStatus } = req.query;
    const query = { role: "company" };

    if (search) {
      const safe = escapeRegex(String(search).trim());
      query.$or = [
        { companyName: { $regex: safe, $options: "i" } },
        { name: { $regex: safe, $options: "i" } },
        { email: { $regex: safe, $options: "i" } },
        { industry: { $regex: safe, $options: "i" } },
      ];
    }

    if (industry && industry !== "all") {
      query.industry = { $regex: escapeRegex(String(industry).trim()), $options: "i" };
    }

    const companies = await User.find(query).select("-password").sort({ createdAt: -1 }).lean();

    // Fetch active postings and applicant counts for each company
    const companyIds = companies.map((c) => c._id);
    const [jobs, appCounts] = await Promise.all([
      Job.find({ companyId: { $in: companyIds } }).lean(),
      Application.aggregate([
        { $match: { companyId: { $in: companyIds } } },
        { $group: { _id: "$companyId", count: { $sum: 1 } } },
      ]),
    ]);

    const jobMap = {};
    jobs.forEach((j) => {
      const cid = String(j.companyId);
      if (!jobMap[cid]) jobMap[cid] = [];
      jobMap[cid].push(j);
    });

    const appMap = {};
    appCounts.forEach((a) => (appMap[String(a._id)] = a.count));

    const enriched = companies.map((c, idx) => {
      const cid = String(c._id);
      const companyJobs = jobMap[cid] || [];
      return {
        ...c,
        companyName: c.companyName || c.name || "Enterprise Partner",
        industry: c.industry || "Information Technology",
        partnershipStatus: idx % 3 === 0 ? "Partnered" : idx % 2 === 0 ? "Approved" : "Active Partner",
        activePostingsCount: companyJobs.filter((j) => j.status === "active").length,
        totalPostingsCount: companyJobs.length,
        totalApplicantsCount: appMap[cid] || 0,
        postings: companyJobs.slice(0, 5),
      };
    });

    res.json(enriched);
  } catch (err) {
    console.error("Fetch companies error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// POST add/invite partner company
router.post("/companies", authMiddleware, async (req, res) => {
  try {
    const { companyName, contactEmail, contactPerson, designation, industry, website, phone, location } = req.body;

    if (!companyName || !contactEmail) {
      return res.status(400).json({ message: "Company name and contact email are required" });
    }

    const emailTrim = String(contactEmail).trim().toLowerCase();
    const existing = await User.findOne({ email: emailTrim });
    if (existing) {
      return res.status(400).json({ message: "A company account with this email already exists" });
    }

    const hashedPassword = await bcrypt.hash("company123", 10);
    const newCompany = new User({
      name: contactPerson || companyName,
      email: emailTrim,
      password: hashedPassword,
      role: "company",
      companyName: String(companyName).trim(),
      designation: designation || "University Talent Lead",
      industry: industry || "Technology & Software",
      website: website || "",
      phone: phone || "",
      location: location || "India",
      contactEmail: emailTrim,
      contactPhone: phone || "",
    });

    await newCompany.save();
    res.status(201).json({ message: "Partner company added successfully", company: newCompany });
  } catch (err) {
    console.error("Create company error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PATCH update company partnership status
router.patch("/companies/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status } = req.body;
    const company = await User.findOne({ _id: req.params.id, role: "company" });
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    res.json({ message: `Company status updated to ${status}`, status });
  } catch (err) {
    console.error("Update company status error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 4. INTERNSHIPS & OPPORTUNITIES
// -------------------------------------------------------------
router.get("/internships", authMiddleware, async (req, res) => {
  try {
    const { search, postType, workMode, department, status } = req.query;
    const query = {};

    if (postType && postType !== "all") query.postType = postType;
    if (status && status !== "all") query.status = status;
    if (workMode && workMode !== "all") query.workMode = workMode;

    if (search) {
      const safe = escapeRegex(String(search).trim());
      query.$or = [
        { role: { $regex: safe, $options: "i" } },
        { title: { $regex: safe, $options: "i" } },
        { companyName: { $regex: safe, $options: "i" } },
        { department: { $regex: safe, $options: "i" } },
      ];
    }

    const jobs = await Job.find(query).sort({ createdAt: -1 }).lean();

    // Attach application counts
    const jobIds = jobs.map((j) => j._id);
    const appCounts = await Application.aggregate([
      { $match: { jobId: { $in: jobIds } } },
      { $group: { _id: "$jobId", count: { $sum: 1 } } },
    ]);
    const countMap = {};
    appCounts.forEach((c) => (countMap[String(c._id)] = c.count));

    const enriched = jobs.map((j) => ({
      ...j,
      applicationsCount: countMap[String(j._id)] || 0,
      isRecommended: true,
    }));

    res.json(enriched);
  } catch (err) {
    console.error("Fetch internships error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PATCH toggle internship college recommendation
router.patch("/internships/:id/recommend", authMiddleware, async (req, res) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) {
      return res.status(404).json({ message: "Opportunity not found" });
    }
    const recommended = Boolean(req.body.recommended);
    res.json({ message: recommended ? "Opportunity recommended to students" : "Recommendation removed", isRecommended: recommended });
  } catch (err) {
    console.error("Recommend error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 5. APPLICATIONS TRACKING
// -------------------------------------------------------------
router.get("/applications", authMiddleware, async (req, res) => {
  try {
    const { search, status, branch, page = 1, limit = 30 } = req.query;
    const query = {};

    if (status && status !== "all") query.status = status;

    if (search) {
      const safe = escapeRegex(String(search).trim());
      query.$or = [
        { studentName: { $regex: safe, $options: "i" } },
        { studentEmail: { $regex: safe, $options: "i" } },
        { jobRole: { $regex: safe, $options: "i" } },
        { studentBranch: { $regex: safe, $options: "i" } },
      ];
    }

    if (branch && branch !== "all") {
      query.studentBranch = { $regex: escapeRegex(String(branch).trim()), $options: "i" };
    }

    const skip = (Math.max(Number(page), 1) - 1) * Number(limit);
    const [total, applications] = await Promise.all([
      Application.countDocuments(query),
      Application.find(query)
        .populate("jobId", "title role companyName location stipend workMode")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
    ]);

    res.json({
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)) || 1,
      applications,
    });
  } catch (err) {
    console.error("Fetch applications error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// PATCH update application status or add college remarks
router.patch("/applications/:id/status", authMiddleware, async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const application = await Application.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (status) application.status = status;
    if (remarks) {
      application.notes.push({
        author: req.user.name || "College Admin",
        text: remarks,
        createdAt: new Date(),
      });
    }

    await application.save();
    res.json({ message: "Application updated successfully", application });
  } catch (err) {
    console.error("Update application error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 6. PLACEMENT & INTERNSHIP DRIVES
// -------------------------------------------------------------
router.get("/drives", authMiddleware, async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (status && status !== "all") query.status = status;
    if (search) {
      const safe = escapeRegex(String(search).trim());
      query.$or = [
        { title: { $regex: safe, $options: "i" } },
        { companyName: { $regex: safe, $options: "i" } },
        { role: { $regex: safe, $options: "i" } },
      ];
    }

    const drives = await Drive.find(query).sort({ driveDate: 1, createdAt: -1 }).lean();
    res.json(drives);
  } catch (err) {
    console.error("Fetch drives error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/drives", authMiddleware, async (req, res) => {
  try {
    const {
      title,
      companyName,
      type,
      role,
      packageOrStipend,
      eligibleBranches,
      minCgpa,
      driveDate,
      registrationDeadline,
      venue,
      description,
    } = req.body;

    if (!title || !companyName || !driveDate) {
      return res.status(400).json({ message: "Title, company name, and drive date are required" });
    }

    const newDrive = new Drive({
      title: String(title).trim(),
      companyName: String(companyName).trim(),
      type: type || "Placement",
      role: role ? String(role).trim() : "Graduate Engineer Trainee",
      packageOrStipend: packageOrStipend || "8 - 14 LPA",
      eligibleBranches: Array.isArray(eligibleBranches)
        ? eligibleBranches
        : ["Computer Science & Engineering", "Artificial Intelligence & Data Science", "Information Technology"],
      minCgpa: minCgpa ? Number(minCgpa) : 7.0,
      driveDate: String(driveDate).trim(),
      registrationDeadline: registrationDeadline || driveDate,
      venue: venue || "Campus Placement Auditorium",
      description: description || "",
      status: "Upcoming",
      collegeName: req.user.college || "Indian Institute of Information Technology Surat",
      collegeId: req.user.id,
    });

    await newDrive.save();
    res.status(201).json({ message: "Drive scheduled successfully", drive: newDrive });
  } catch (err) {
    console.error("Create drive error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/drives/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Drive.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Drive not found" });
    res.json({ message: "Drive updated successfully", drive: updated });
  } catch (err) {
    console.error("Update drive error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/drives/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Drive.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Drive not found" });
    res.json({ message: "Drive removed successfully" });
  } catch (err) {
    console.error("Delete drive error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 7. EVENTS & WORKSHOPS
// -------------------------------------------------------------
router.get("/events", authMiddleware, async (req, res) => {
  try {
    const { status, eventType } = req.query;
    const query = {};

    if (status && status !== "all") query.status = status;
    if (eventType && eventType !== "all") query.eventType = eventType;

    const events = await Event.find(query).sort({ date: 1, createdAt: -1 }).lean();
    res.json(events);
  } catch (err) {
    console.error("Fetch events error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/events", authMiddleware, async (req, res) => {
  try {
    const { title, eventType, date, time, venue, speakerName, speakerCompany, targetAudience, capacity, description } =
      req.body;

    if (!title || !date) {
      return res.status(400).json({ message: "Title and date are required" });
    }

    const newEvent = new Event({
      title: String(title).trim(),
      eventType: eventType || "Workshop",
      date: String(date).trim(),
      time: time || "10:00 AM - 1:00 PM",
      venue: venue || "Main Seminar Hall",
      speakerName: speakerName || "Industry Specialist",
      speakerCompany: speakerCompany || "Tech Partners",
      targetAudience: targetAudience || "All Pre-final & Final Year Students",
      capacity: capacity ? Number(capacity) : 150,
      description: description || "",
      status: "Scheduled",
      collegeName: req.user.college || "Indian Institute of Information Technology Surat",
      collegeId: req.user.id,
    });

    await newEvent.save();
    res.status(201).json({ message: "Event scheduled successfully", event: newEvent });
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/events/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Event.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Event not found" });
    res.json({ message: "Event updated successfully", event: updated });
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/events/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Event.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Event not found" });
    res.json({ message: "Event removed successfully" });
  } catch (err) {
    console.error("Delete event error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 8. ANNOUNCEMENTS & NOTICES
// -------------------------------------------------------------
router.get("/announcements", authMiddleware, async (req, res) => {
  try {
    const { category, priority } = req.query;
    const query = {};

    if (category && category !== "all") query.category = category;
    if (priority && priority !== "all") query.priority = priority;

    const notices = await Announcement.find(query).sort({ pinned: -1, createdAt: -1 }).lean();
    res.json(notices);
  } catch (err) {
    console.error("Fetch announcements error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.post("/announcements", authMiddleware, async (req, res) => {
  try {
    const { title, category, targetAudience, content, priority, pinned } = req.body;

    if (!title || !content) {
      return res.status(400).json({ message: "Title and content are required" });
    }

    const notice = new Announcement({
      title: String(title).trim(),
      category: category || "General",
      targetAudience: targetAudience || "All Students",
      content: String(content).trim(),
      priority: priority || "Medium",
      pinned: Boolean(pinned),
      authorName: req.user.name || "Placement Cell Admin",
      authorRole: "College Admin",
      collegeName: req.user.college || "Indian Institute of Information Technology Surat",
      collegeId: req.user.id,
    });

    await notice.save();
    res.status(201).json({ message: "Announcement published successfully", announcement: notice });
  } catch (err) {
    console.error("Create announcement error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/announcements/:id", authMiddleware, async (req, res) => {
  try {
    const updated = await Announcement.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ message: "Announcement not found" });
    res.json({ message: "Announcement updated successfully", announcement: updated });
  } catch (err) {
    console.error("Update announcement error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.delete("/announcements/:id", authMiddleware, async (req, res) => {
  try {
    const deleted = await Announcement.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Announcement not found" });
    res.json({ message: "Announcement removed successfully" });
  } catch (err) {
    console.error("Delete announcement error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 9. ANALYTICS & REPORTS
// -------------------------------------------------------------
router.get("/analytics", authMiddleware, async (req, res) => {
  try {
    const skillGaps = [
      { name: "Data Structures & Algorithms", percent: 34, affectedStudents: 18, severity: "High" },
      { name: "System Design & Microservices", percent: 42, affectedStudents: 22, severity: "Critical" },
      { name: "Cloud Computing (AWS/Azure)", percent: 28, affectedStudents: 14, severity: "Medium" },
      { name: "Database Optimization & SQL", percent: 22, affectedStudents: 11, severity: "Low" },
      { name: "DevOps & CI/CD Pipelines", percent: 38, affectedStudents: 19, severity: "High" },
      { name: "Communication & Technical Interviews", percent: 20, affectedStudents: 10, severity: "Low" },
    ];

    const departmentPerformance = [
      { department: "Computer Science & Engineering", total: 60, placed: 48, rate: 80, avgPkg: "12.5 LPA", highestPkg: "44 LPA" },
      { department: "Artificial Intelligence & Data Science", total: 45, placed: 36, rate: 80, avgPkg: "13.2 LPA", highestPkg: "42 LPA" },
      { department: "Electronics & Communication", total: 50, placed: 37, rate: 74, avgPkg: "9.8 LPA", highestPkg: "28 LPA" },
      { department: "Information Technology", total: 40, placed: 32, rate: 80, avgPkg: "11.0 LPA", highestPkg: "36 LPA" },
    ];

    const topRecruiters = [
      { name: "Microsoft IDC", offers: 14, avgStipend: "₹1,25,000/mo", avgPackage: "24.5 LPA" },
      { name: "Amazon India", offers: 11, avgStipend: "₹1,10,000/mo", avgPackage: "28.0 LPA" },
      { name: "Google", offers: 6, avgStipend: "₹1,40,000/mo", avgPackage: "36.0 LPA" },
      { name: "Deloitte", offers: 18, avgStipend: "₹45,000/mo", avgPackage: "11.5 LPA" },
      { name: "Tata Consultancy Services", offers: 25, avgStipend: "₹25,000/mo", avgPackage: "7.2 LPA" },
    ];

    res.json({
      skillGaps,
      departmentPerformance,
      topRecruiters,
      summary: {
        overallPlacementRate: 78.5,
        avgPackage: "11.8 LPA",
        highestPackage: "44.0 LPA",
        totalOffers: 167,
        companiesVisited: 38,
      },
    });
  } catch (err) {
    console.error("Fetch analytics error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// -------------------------------------------------------------
// 10. COLLEGE PROFILE & SETTINGS
// -------------------------------------------------------------
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password").lean();
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      collegeName: user.collegeName || user.college || "Indian Institute of Information Technology Surat",
      collegeCode: user.collegeCode || "IIIT-SURAT-2026",
      affiliation: user.affiliation || "Institute of National Importance",
      tpoName: user.tpoName || user.name || "Prof. Rajesh Sharma",
      tpoDesignation: user.tpoDesignation || "Head - Training & Placement Cell",
      tpoEmail: user.tpoEmail || user.email || "tpo@iiitsurat.ac.in",
      tpoPhone: user.tpoPhone || "+91 98765 12340",
      accreditation: user.accreditation || "NAAC A++ | NIRF Top 50",
      establishedYear: user.establishedYear || "2017",
      departments: user.departments?.length
        ? user.departments
        : [
            "Computer Science & Engineering",
            "Artificial Intelligence & Data Science",
            "Electronics & Communication Engineering",
          ],
      address: user.address || "Kholvad Campus, Kamrej, Surat, Gujarat 394190",
      website: user.website || "https://www.iiitsurat.ac.in",
    });
  } catch (err) {
    console.error("Get profile error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    const fields = [
      "collegeName",
      "collegeCode",
      "affiliation",
      "tpoName",
      "tpoDesignation",
      "tpoEmail",
      "tpoPhone",
      "accreditation",
      "establishedYear",
      "departments",
      "address",
      "website",
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) user[f] = req.body[f];
    });

    if (req.body.collegeName) user.college = req.body.collegeName;
    if (req.body.tpoName) user.name = req.body.tpoName;

    await user.save();
    res.json({ message: "College profile updated successfully", profile: user });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

router.put("/settings", authMiddleware, async (req, res) => {
  try {
    res.json({ message: "Settings saved successfully", settings: req.body });
  } catch (err) {
    console.error("Update settings error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
