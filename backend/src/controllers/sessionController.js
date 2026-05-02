const { v4: uuidv4 } = require('uuid');
const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { generateToken } = require('../utils/tokenGenerator');
const { getIO, emitAttendanceUpdate, emitTokenRefresh, emitNewSession } = require('../sockets/socketManager');

const TOKEN_EXPIRE_SECONDS = 120; // 2 minutes
const refreshTimers = new Map();

exports.startSession = async (req, res) => {
  try {
    const { class: cls, subject } = req.body;
    if (!cls || !subject) return res.status(400).json({ message: 'Class and subject are required' });

    const sessionId = uuidv4();
    const { token, tokenFrequency, pattern } = generateToken(sessionId);
    const expiresAt = new Date(Date.now() + TOKEN_EXPIRE_SECONDS * 1000);

    // End any existing active sessions for this teacher
    await Session.updateMany(
      { teacherId: req.user._id, isActive: true },
      { isActive: false, endedAt: new Date() }
    );

    const session = await Session.create({
      sessionId, teacherId: req.user._id,
      class: cls, subject, token, tokenFrequency, pattern, expiresAt, isActive: true
    });

    // Broadcast to ALL connected clients so students can detect
    emitNewSession({
      sessionId, class: cls, subject,
      tokenFrequency, pattern, expiresAt,
      teacherId: req.user._id.toString()
    });

    // Schedule token refresh
    scheduleTokenRefresh(sessionId);

    res.status(201).json({ session, sessionId, tokenFrequency, pattern, expiresAt });
  } catch (error) {
    console.error('startSession error:', error);
    res.status(500).json({ message: error.message });
  }
};

function scheduleTokenRefresh(sessionId) {
  if (refreshTimers.has(sessionId)) clearInterval(refreshTimers.get(sessionId));

  const interval = (TOKEN_EXPIRE_SECONDS - 15) * 1000;
  const timer = setInterval(async () => {
    try {
      const session = await Session.findOne({ sessionId, isActive: true });
      if (!session) { clearInterval(timer); refreshTimers.delete(sessionId); return; }

      const { token, tokenFrequency, pattern } = generateToken(sessionId);
      const expiresAt = new Date(Date.now() + TOKEN_EXPIRE_SECONDS * 1000);
      await Session.updateOne({ sessionId }, { token, tokenFrequency, pattern, expiresAt });

      emitTokenRefresh(sessionId, { sessionId, tokenFrequency, pattern, expiresAt });
      console.log(`[Session] Token refreshed for ${sessionId} -> ${tokenFrequency}Hz`);
    } catch (err) {
      console.error('Token refresh error:', err);
    }
  }, interval);

  refreshTimers.set(sessionId, timer);
}

exports.endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findOneAndUpdate(
      { sessionId, teacherId: req.user._id },
      { isActive: false, endedAt: new Date() },
      { new: true }
    );
    if (!session) return res.status(404).json({ message: 'Session not found' });

    if (refreshTimers.has(sessionId)) {
      clearInterval(refreshTimers.get(sessionId));
      refreshTimers.delete(sessionId);
    }

    const io = getIO();
    if (io) io.to(`session:${sessionId}`).emit('session:ended', { sessionId });

    res.json({ message: 'Session ended', session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getActiveSession = async (req, res) => {
  try {
    const session = await Session.findOne({ teacherId: req.user._id, isActive: true });
    res.json({ session });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLiveAttendance = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await Session.findOne({ sessionId });
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const attendance = await Attendance.find({ sessionId })
      .populate('studentDbId', 'name rollNumber class');

    const students = await Student.find({
      teacherId: session.teacherId,
      class: session.class
    });

    const attendanceMap = {};
    attendance.forEach(a => {
      if (a.studentDbId) attendanceMap[a.studentDbId._id.toString()] = a;
    });

    const list = students.map(s => ({
      studentId: s._id,
      name: s.name,
      rollNumber: s.rollNumber,
      class: s.class,
      status: attendanceMap[s._id.toString()] ? 'present' : 'absent',
      markedAt: attendanceMap[s._id.toString()]?.markedAt
    }));

    res.json({ list, session, presentCount: attendance.length, totalCount: students.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};