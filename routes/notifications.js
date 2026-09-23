const express = require("express");
const Notification = require("../models/Notification");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET all notifications
router.get("/", authMiddleware, async (req, res) => {
  try {
    const notifs = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(notifs);
  } catch (err) {
    console.error("Fetch notifications error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// MARK single as read
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { read: true } },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification marked read", notification: notif });
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// MARK all as read
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.id }, { $set: { read: true } });
    res.json({ message: "All notifications marked as read" });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CLEAR / DELETE single notification
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const notif = await Notification.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    res.json({ message: "Notification removed", id: req.params.id });
  } catch (err) {
    console.error("Delete notification error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// CLEAR all notifications
router.delete("/", authMiddleware, async (req, res) => {
  try {
    await Notification.deleteMany({ userId: req.user.id });
    res.json({ message: "All notifications cleared" });
  } catch (err) {
    console.error("Clear notifications error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
