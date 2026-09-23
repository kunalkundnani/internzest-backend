const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: {
      type: String,
      enum: ["Placement", "Internship", "Academic", "Urgent", "General"],
      default: "General",
      index: true,
    },
    targetAudience: { type: String, default: "All Students", trim: true },
    content: { type: String, required: true, trim: true },
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Urgent"],
      default: "Medium",
    },
    pinned: { type: Boolean, default: false },
    authorName: { type: String, default: "Placement Cell Admin", trim: true },
    authorRole: { type: String, default: "College Admin", trim: true },
    attachments: [{ type: String, trim: true }],
    viewsCount: { type: Number, default: 0 },
    collegeName: { type: String, default: "Indian Institute of Information Technology Surat", trim: true },
    collegeId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Announcement", announcementSchema);
