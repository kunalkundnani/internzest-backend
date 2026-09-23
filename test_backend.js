const mongoose = require("mongoose");
require("dotenv").config();

// We will use native fetch since Node 18+ includes it
const BASE_URL = "http://localhost:5000";

let studentToken = null;
let studentUser = null;
let companyToken = null;
let companyUser = null;
let secondStudentToken = null;
let createdSkillId = null;
let createdJobId = null;

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${message}`);
  } else {
    failedTests++;
    console.error(`  ❌ FAIL: ${message}`);
  }
}

async function runTests() {
  console.log("\n=========================================");
  console.log("  STARTING COMPREHENSIVE BACKEND TESTS  ");
  console.log("=========================================\n");

  const timestamp = Date.now();
  const testStudentEmail = `test_student_${timestamp}@college.edu`;
  const testCompanyEmail = `test_company_${timestamp}@company.com`;
  const testStudent2Email = `test_student2_${timestamp}@college.edu`;
  const testPassword = "password123";

  try {
    // -------------------------------------------------------------
    // TEST SUITE 1: ROOT & HEALTH ENDPOINTS
    // -------------------------------------------------------------
    console.log("--- 1. Testing System & Health Endpoints ---");

    const rootRes = await fetch(`${BASE_URL}/`);
    const rootData = await rootRes.json();
    assert(rootRes.status === 200 && rootData.message.includes("running"), "GET / returns 200 with welcome message");

    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    assert(healthRes.status === 200 && healthData.status === "ok" && healthData.database === "connected", "GET /api/health returns status 'ok' and database 'connected'");

    const notFoundRes = await fetch(`${BASE_URL}/api/non-existent-route`);
    const notFoundData = await notFoundRes.json();
    assert(notFoundRes.status === 404 && notFoundData.message.includes("Cannot GET"), "GET /api/non-existent-route returns 404 JSON error");

    // -------------------------------------------------------------
    // TEST SUITE 2: AUTHENTICATION & VALIDATION
    // -------------------------------------------------------------
    console.log("\n--- 2. Testing Auth Registration & Validation ---");

    // Missing fields
    const regMissingRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudentEmail, password: testPassword }),
    });
    assert(regMissingRes.status === 400, "POST /api/auth/register rejects missing fields with 400");

    // Invalid email
    const regBadEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", email: "notanemail", password: testPassword, role: "student" }),
    });
    assert(regBadEmailRes.status === 400, "POST /api/auth/register rejects invalid email format with 400");

    // Invalid role
    const regBadRoleRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", email: testStudentEmail, password: testPassword, role: "superadmin" }),
    });
    assert(regBadRoleRes.status === 400, "POST /api/auth/register rejects unauthorized role with 400");

    // Short password
    const regShortPassRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Test", email: testStudentEmail, password: "123", role: "student" }),
    });
    assert(regShortPassRes.status === 400, "POST /api/auth/register rejects passwords < 6 characters with 400");

    // Valid Student Registration
    const regStudentRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Student",
        email: testStudentEmail,
        password: testPassword,
        role: "student",
        college: "IIIT Surat",
        branch: "Computer Science",
        year: "3rd Year",
      }),
    });
    const regStudentData = await regStudentRes.json();
    assert(regStudentRes.status === 201 && regStudentData.user.email === testStudentEmail.toLowerCase(), "POST /api/auth/register registers student with 201");

    // Duplicate Registration check (case-insensitive)
    const regDupRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test Student Duplicate",
        email: testStudentEmail.toUpperCase(),
        password: testPassword,
        role: "student",
      }),
    });
    assert(regDupRes.status === 400, "POST /api/auth/register prevents duplicate email registration (case-insensitive)");

    // Valid Company Registration
    const regCompanyRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Acme Tech",
        email: testCompanyEmail,
        password: testPassword,
        role: "company",
      }),
    });
    assert(regCompanyRes.status === 201, "POST /api/auth/register registers company with 201");

    // Register 2nd Student (for isolation tests)
    const regStudent2Res = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Second Student",
        email: testStudent2Email,
        password: testPassword,
        role: "student",
      }),
    });
    assert(regStudent2Res.status === 201, "POST /api/auth/register registers second student with 201");

    // -------------------------------------------------------------
    // TEST SUITE 3: LOGIN & TOKENS
    // -------------------------------------------------------------
    console.log("\n--- 3. Testing Auth Login & JWT Generation ---");

    // Invalid password
    const loginBadPass = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudentEmail, password: "wrongpassword", role: "student" }),
    });
    assert(loginBadPass.status === 400, "POST /api/auth/login rejects incorrect password with 400");

    // Role mismatch
    const loginRoleMismatch = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudentEmail, password: testPassword, role: "company" }),
    });
    assert(loginRoleMismatch.status === 400, "POST /api/auth/login rejects mismatched role with 400");

    // Valid Student Login
    const loginStudentRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudentEmail, password: testPassword, role: "student" }),
    });
    const loginStudentData = await loginStudentRes.json();
    studentToken = loginStudentData.token;
    studentUser = loginStudentData.user;
    assert(loginStudentRes.status === 200 && Boolean(studentToken), "POST /api/auth/login succeeds for student and returns JWT token");

    // Valid Company Login
    const loginCompanyRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testCompanyEmail, password: testPassword, role: "company" }),
    });
    const loginCompanyData = await loginCompanyRes.json();
    companyToken = loginCompanyData.token;
    companyUser = loginCompanyData.user;
    assert(loginCompanyRes.status === 200 && Boolean(companyToken), "POST /api/auth/login succeeds for company and returns JWT token");

    // Valid 2nd Student Login
    const loginStudent2Res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudent2Email, password: testPassword, role: "student" }),
    });
    const loginStudent2Data = await loginStudent2Res.json();
    secondStudentToken = loginStudent2Data.token;

    // -------------------------------------------------------------
    // TEST SUITE 4: PROFILE MANAGEMENT (/me, /profile, /change-password)
    // -------------------------------------------------------------
    console.log("\n--- 4. Testing Profile Management ---");

    // Unauthorized /me
    const meNoAuth = await fetch(`${BASE_URL}/api/auth/me`);
    assert(meNoAuth.status === 401, "GET /api/auth/me rejects unauthenticated request with 401");

    // Authorized /me
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const meData = await meRes.json();
    assert(meRes.status === 200 && meData.user.id === studentUser.id && meData.user.password === undefined, "GET /api/auth/me returns current user without password");

    // Update profile
    const updateProfileRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        bio: "Aspiring Full Stack Engineer",
        phone: "+91 9876543210",
        location: "Surat, Gujarat",
        github: "https://github.com/teststudent",
        linkedin: "https://linkedin.com/in/teststudent",
      }),
    });
    const updateProfileData = await updateProfileRes.json();
    assert(updateProfileRes.status === 200 && updateProfileData.user.bio === "Aspiring Full Stack Engineer" && updateProfileData.user.phone === "+91 9876543210", "PUT /api/auth/profile updates profile fields properly");

    // Change password (wrong current password)
    const badChangePass = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ currentPassword: "wrongpass123", newPassword: "newpassword123" }),
    });
    assert(badChangePass.status === 400, "PUT /api/auth/change-password rejects incorrect current password with 400");

    // Change password (valid)
    const goodChangePass = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ currentPassword: testPassword, newPassword: "newpassword123" }),
    });
    assert(goodChangePass.status === 200, "PUT /api/auth/change-password successfully updates password");

    // Verify login with new password
    const loginNewPass = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testStudentEmail, password: "newpassword123", role: "student" }),
    });
    assert(loginNewPass.status === 200, "POST /api/auth/login succeeds with updated password");

    // -------------------------------------------------------------
    // TEST SUITE 5: SKILLS API (/api/skills)
    // -------------------------------------------------------------
    console.log("\n--- 5. Testing Skills Endpoints & Security ---");

    // Missing token
    const skillsNoAuth = await fetch(`${BASE_URL}/api/skills`);
    assert(skillsNoAuth.status === 401, "GET /api/skills rejects without token with 401");

    // Malformed/Null token
    const skillsNullToken = await fetch(`${BASE_URL}/api/skills`, {
      headers: { Authorization: "Bearer null" },
    });
    assert(skillsNullToken.status === 401, "GET /api/skills rejects 'Bearer null' with 401");

    // Validation: Missing name
    const skillNoName = await fetch(`${BASE_URL}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ level: "Beginner", percent: 50 }),
    });
    assert(skillNoName.status === 400, "POST /api/skills rejects missing name with 400");

    // Validation: Out-of-range percent
    const skillBadPercent = await fetch(`${BASE_URL}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: "Docker", level: "Beginner", percent: 150 }),
    });
    assert(skillBadPercent.status === 400, "POST /api/skills rejects percent > 100 with 400");

    // Add Skill with special characters ("C++") - tests REGEX INJECTION fix
    const skillCpp = await fetch(`${BASE_URL}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: "C++", level: "Intermediate", percent: 65 }),
    });
    const skillCppData = await skillCpp.json();
    createdSkillId = skillCppData._id;
    assert(skillCpp.status === 201 && skillCppData.name === "C++" && skillCppData.percent === 65, "POST /api/skills adds 'C++' successfully without regex crash (ReDoS fix verified)");

    // Duplicate skill rejection
    const skillCppDup = await fetch(`${BASE_URL}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: "c++", level: "Advanced", percent: 90 }),
    });
    assert(skillCppDup.status === 400, "POST /api/skills rejects duplicate skill (case-insensitive)");

    // Add another skill: React
    const skillReact = await fetch(`${BASE_URL}/api/skills`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ name: "React.js", level: "Advanced", percent: 85 }),
    });
    assert(skillReact.status === 201, "POST /api/skills adds 'React.js' successfully");

    // GET all skills for logged-in student
    const getSkillsRes = await fetch(`${BASE_URL}/api/skills`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const getSkillsData = await getSkillsRes.json();
    assert(getSkillsRes.status === 200 && getSkillsData.length >= 2, `GET /api/skills retrieves ${getSkillsData.length} skills for student`);

    // GET single skill by ID
    const getSingleSkill = await fetch(`${BASE_URL}/api/skills/${createdSkillId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const singleSkillData = await getSingleSkill.json();
    assert(getSingleSkill.status === 200 && singleSkillData._id === createdSkillId, "GET /api/skills/:id returns requested skill");

    // GET skill with invalid ObjectId format
    const getBadIdSkill = await fetch(`${BASE_URL}/api/skills/not-an-id`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(getBadIdSkill.status === 400, "GET /api/skills/:id rejects invalid ObjectId format with 400 instead of 500");

    // PUT skill update (quiz score & verification)
    const updateSkillRes = await fetch(`${BASE_URL}/api/skills/${createdSkillId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ percent: 90, verified: true, quizScore: 92, level: "Advanced" }),
    });
    const updateSkillData = await updateSkillRes.json();
    assert(updateSkillRes.status === 200 && updateSkillData.verified === true && updateSkillData.quizScore === 92 && updateSkillData.level === "Advanced", "PUT /api/skills/:id updates verification, quizScore, and level");

    // User Isolation check: Student 2 cannot update Student 1's skill
    const isoUpdateRes = await fetch(`${BASE_URL}/api/skills/${createdSkillId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${secondStudentToken}` },
      body: JSON.stringify({ percent: 10 }),
    });
    assert(isoUpdateRes.status === 404, "PUT /api/skills/:id returns 404 when another user tries to edit someone else's skill (User Isolation verified)");

    // User Isolation check: Student 2 cannot delete Student 1's skill
    const isoDeleteRes = await fetch(`${BASE_URL}/api/skills/${createdSkillId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${secondStudentToken}` },
    });
    assert(isoDeleteRes.status === 404, "DELETE /api/skills/:id returns 404 when another user tries to delete someone else's skill (User Isolation verified)");

    // Delete skill by owner
    const deleteSkillRes = await fetch(`${BASE_URL}/api/skills/${createdSkillId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(deleteSkillRes.status === 200, "DELETE /api/skills/:id successfully deletes skill");

    // -------------------------------------------------------------
    // TEST SUITE 6: JOBS API (/api/jobs)
    // -------------------------------------------------------------
    console.log("\n--- 6. Testing Jobs Endpoints & Role Authorization ---");

    // Student trying to post a job
    const studentPostJob = await fetch(`${BASE_URL}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${studentToken}` },
      body: JSON.stringify({ role: "Junior Dev", companyName: "Fake Corp" }),
    });
    assert(studentPostJob.status === 403, "POST /api/jobs blocks student with 403 (Only companies can post)");

    // Company missing role/companyName
    const companyBadJob = await fetch(`${BASE_URL}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({ type: "Internship" }),
    });
    assert(companyBadJob.status === 400, "POST /api/jobs rejects missing companyName or role with 400");

    // Company posting valid job
    const companyGoodJob = await fetch(`${BASE_URL}/api/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({
        companyName: "Acme Tech Innovations",
        role: "Full Stack Engineer Intern",
        type: "Internship",
        location: "Remote",
        stipend: "₹25,000/month",
        duration: "6 Months",
        description: "Looking for a motivated intern with React and Node.js knowledge.",
        requiredSkills: [
          { name: "React", minPercent: 70 },
          { name: "Node.js", minPercent: 60 },
        ],
      }),
    });
    const companyJobData = await companyGoodJob.json();
    createdJobId = companyJobData._id;
    assert(companyGoodJob.status === 201 && companyJobData.companyName === "Acme Tech Innovations" && companyJobData.requiredSkills.length === 2, "POST /api/jobs creates job with 201 and formats requiredSkills");

    // Student browsing jobs
    const getJobsRes = await fetch(`${BASE_URL}/api/jobs`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const getJobsData = await getJobsRes.json();
    assert(getJobsRes.status === 200 && Array.isArray(getJobsData) && getJobsData.length > 0, "GET /api/jobs allows students to view active jobs");

    // Filter jobs by search
    const searchJobsRes = await fetch(`${BASE_URL}/api/jobs?search=Full%20Stack`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const searchJobsData = await searchJobsRes.json();
    assert(searchJobsRes.status === 200 && searchJobsData.length > 0, "GET /api/jobs?search=... properly filters jobs");

    // GET single job
    const getSingleJob = await fetch(`${BASE_URL}/api/jobs/${createdJobId}`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    const singleJobData = await getSingleJob.json();
    assert(getSingleJob.status === 200 && singleJobData._id === createdJobId, "GET /api/jobs/:id returns single job details");

    // Company viewing their postings
    const companyMyJobs = await fetch(`${BASE_URL}/api/jobs/my`, {
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    const myJobsData = await companyMyJobs.json();
    assert(companyMyJobs.status === 200 && myJobsData.length > 0, "GET /api/jobs/my returns company's own postings");

    // Student blocked from /my
    const studentMyJobs = await fetch(`${BASE_URL}/api/jobs/my`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert(studentMyJobs.status === 403, "GET /api/jobs/my blocks non-company users with 403");

    // Company updating their job
    const updateJobRes = await fetch(`${BASE_URL}/api/jobs/${createdJobId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${companyToken}` },
      body: JSON.stringify({ stipend: "₹30,000/month", location: "Hybrid" }),
    });
    const updateJobData = await updateJobRes.json();
    assert(updateJobRes.status === 200 && updateJobData.stipend === "₹30,000/month" && updateJobData.location === "Hybrid", "PUT /api/jobs/:id updates job stipend and location");

    // Company deleting their job
    const deleteJobRes = await fetch(`${BASE_URL}/api/jobs/${createdJobId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${companyToken}` },
    });
    assert(deleteJobRes.status === 200, "DELETE /api/jobs/:id removes job successfully");

  } catch (err) {
    console.error("Test execution error:", err);
  } finally {
    // -------------------------------------------------------------
    // CLEAN UP TEST DATA
    // -------------------------------------------------------------
    console.log("\n--- Cleaning Up Temporary Test Records ---");
    try {
      await mongoose.connect(process.env.MONGO_URI);
      const User = require("./models/User");
      const Skill = require("./models/Skill");
      const Job = require("./models/Job");

      const deletedUsers = await User.deleteMany({ email: { $regex: /^test_/ } });
      const deletedSkills = await Skill.deleteMany({ name: { $in: ["C++", "React.js"] } });
      const deletedJobs = await Job.deleteMany({ companyName: "Acme Tech Innovations" });

      console.log(`Cleaned up: ${deletedUsers.deletedCount} test users, ${deletedSkills.deletedCount} test skills, ${deletedJobs.deletedCount} test jobs.`);
      await mongoose.connection.close();
    } catch (cleanupErr) {
      console.error("Cleanup error:", cleanupErr.message);
    }
  }

  console.log("\n=========================================");
  console.log(`  TEST RESULTS: ${passedTests} PASSED, ${failedTests} FAILED  `);
  console.log("=========================================\n");

  process.exit(failedTests > 0 ? 1 : 0);
}

runTests();
