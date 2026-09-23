const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    conversationId: { type: String, required: true, index: true },
    companyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    candidateName: { type: String, required: true },
    candidateEmail: { type: String, default: "" },
    candidateAvatar: { type: String, default: "🎓" },
    senderRole: { type: String, enum: ["company", "student"], required: true },
    senderName: { type: String, required: true },
    text: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Message", messageSchema);
