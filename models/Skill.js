const mongoose = require("mongoose");

const skillSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    level: { type: String, required: true, trim: true },
    percent: { type: Number, required: true, min: 0, max: 100 },
    verified: { type: Boolean, default: false },
    quizScore: { type: Number, default: null, min: 0, max: 100 },
  },
  { timestamps: true }
);

skillSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model("Skill", skillSchema);