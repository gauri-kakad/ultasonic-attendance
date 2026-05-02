const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema({
  sessionId: { type: String, required: true },
  teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  studentDbId: { type: mongoose.Schema.Types.ObjectId, ref: 'Student' },
  class: { type: String, required: true },
  subject: { type: String, required: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['present', 'absent'], default: 'present' },
  verificationMethod: { type: String, default: 'ultrasonic' },
  markedAt: { type: Date, default: Date.now }
});

attendanceSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });

module.exports = mongoose.model('Attendance', attendanceSchema);