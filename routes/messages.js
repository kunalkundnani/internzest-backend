const express = require("express");
const mongoose = require("mongoose");
const Message = require("../models/Message");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET all conversations for the company
router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only companies can access recruiter conversations" });
    }

    const messages = await Message.find({ companyId: req.user.id }).sort({ createdAt: 1 });

    // Group by conversationId
    const map = {};
    messages.forEach((m) => {
      if (!map[m.conversationId]) {
        map[m.conversationId] = {
          id: m.conversationId,
          candidateName: m.candidateName,
          candidateEmail: m.candidateEmail,
          candidateAvatar: m.candidateAvatar || "🎓",
          unreadCount: 0,
          messages: [],
          lastMessage: m.text,
          lastTime: m.createdAt,
        };
      }
      map[m.conversationId].messages.push({
        id: m._id,
        sender: m.senderRole,
        senderName: m.senderName,
        text: m.text,
        timestamp: m.createdAt,
      });
      map[m.conversationId].lastMessage = m.text;
      map[m.conversationId].lastTime = m.createdAt;
      if (m.senderRole === "student" && !m.read) {
        map[m.conversationId].unreadCount++;
      }
    });

    const conversations = Object.values(map).sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));
    res.json(conversations);
  } catch (err) {
    console.error("Fetch conversations error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// GET messages in a conversation
router.get("/:conversationId", authMiddleware, async (req, res) => {
  try {
    const msgs = await Message.find({
      conversationId: req.params.conversationId,
      companyId: req.user.id,
    }).sort({ createdAt: 1 });

    res.json(msgs);
  } catch (err) {
    console.error("Fetch messages error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// SEND a message
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "company") {
      return res.status(403).json({ message: "Only authorized company users can send messages" });
    }

    const { conversationId, candidateName, candidateEmail, candidateAvatar, text } = req.body;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: "Message text cannot be empty" });
    }

    const convId = conversationId || `conv-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newMsg = new Message({
      conversationId: convId,
      companyId: req.user.id,
      candidateName: candidateName || "Candidate",
      candidateEmail: candidateEmail || "",
      candidateAvatar: candidateAvatar || "🎓",
      senderRole: "company",
      senderName: req.user.name || req.user.companyName || "Recruiter",
      text: String(text).trim(),
      read: true,
    });

    await newMsg.save();

    res.status(201).json({
      message: "Message sent",
      conversationId: convId,
      msg: {
        id: newMsg._id,
        sender: "company",
        senderName: newMsg.senderName,
        text: newMsg.text,
        timestamp: newMsg.createdAt,
      },
    });
  } catch (err) {
    console.error("Send message error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

// MARK conversation as read
router.patch("/:conversationId/read", authMiddleware, async (req, res) => {
  try {
    await Message.updateMany(
      { conversationId: req.params.conversationId, companyId: req.user.id, senderRole: "student" },
      { $set: { read: true } }
    );
    res.json({ message: "Marked as read" });
  } catch (err) {
    console.error("Mark read error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
});

module.exports = router;
