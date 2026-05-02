const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  class: { type: String, required: true },
  subject: { type: String, required: true },
  token: { type: String, required: true },
  tokenFrequency: { type: Number, required: true }, // Hz
  pattern: {
    options: [{ id: String, label: String, icon: String, color: String }],
    correctId: { type: String, required: true }
  },
  expiresAt: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date }
});

module.exports = mongoose.model('Session', sessionSchema);