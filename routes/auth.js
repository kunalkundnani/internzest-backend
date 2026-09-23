const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

const VALID_ROLES = ["student", "company", "college"];

// Helper to sanitize user object for response
function sanitizeUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    college: user.college || "",
    branch: user.branch || "",
    year: user.year || "",
    bio: user.bio || "",
    phone: user.phone || "",
    location: user.location || "",
    github: user.github || "",
    linkedin: user.linkedin || "",
    avatar: user.avatar || "",
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// REGISTER
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, college, branch, year } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "All required fields (name, email, password, role) must be provided" });
    }

    const trimmedName = String(name).trim();
    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedRole = String(role).trim().toLowerCase();

    if (!trimmedName) {
      return res.status(400).json({ message: "Name cannot be empty" });
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    if (!VALID_ROLES.includes(trimmedRole)) {
      return res.status(400).json({
        message: `Invalid role "${role}". Allowed roles are: ${VALID_ROLES.join(", ")}`,
      });
    }

    if (String(password).length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }

    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name: trimmedName,
      email: trimmedEmail,
      password: hashedPassword,
      role: trimmedRole,
      college: college ? String(college).trim() : "",
      branch: branch ? String(branch).trim() : "",
      year: year ? String(year).trim() : "",
    });

    await newUser.save();

    res.status(201).json({
      message: "Account created successfully",
      user: sanitizeUser(newUser),
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// LOGIN
router.post("/login", async (req, res) => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password || !role) {
      return res.status(400).json({ message: "Email, password, and role are required" });
    }

    const trimmedEmail = String(email).trim().toLowerCase();
    const trimmedRole = String(role).trim().toLowerCase();

    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    if (user.role !== trimmedRole) {
      return res.status(400).json({
        message: `This account is registered as "${user.role}", not "${role}"`,
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid email or password" });
    }

    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: "Server configuration error: JWT secret missing" });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      secret,
      { expiresIn: "7d" }
    );

    res.json({
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET CURRENT USER (/api/auth/me)
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// UPDATE PROFILE (/api/auth/profile)
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, college, branch, year, bio, phone, location, github, linkedin, avatar } = req.body;

    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (!trimmed) return res.status(400).json({ message: "Name cannot be empty" });
      user.name = trimmed;
    }
    if (college !== undefined) user.college = String(college).trim();
    if (branch !== undefined) user.branch = String(branch).trim();
    if (year !== undefined) user.year = String(year).trim();
    if (bio !== undefined) user.bio = String(bio).trim();
    if (phone !== undefined) user.phone = String(phone).trim();
    if (location !== undefined) user.location = String(location).trim();
    if (github !== undefined) user.github = String(github).trim();
    if (linkedin !== undefined) user.linkedin = String(linkedin).trim();
    if (avatar !== undefined) user.avatar = String(avatar).trim();

    await user.save();
    res.json({
      message: "Profile updated successfully",
      user: sanitizeUser(user),
    });
  } catch (err) {
    console.error("Update profile error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CHANGE PASSWORD (/api/auth/change-password)
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current password and new password are required" });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters long" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password" });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password updated successfully" });
  } catch (err) {
    console.error("Change password error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;