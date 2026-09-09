const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  level: { type: String, required: true },
  percent: { type: Number, required: true },
  verified: { type: Boolean, default: false },
  quizScore: { type: Number, default: null },
}, { timestamps: true });

module.exports = mongoose.model("Skill", skillSchema);