const Session = require('../models/Session');
const Attendance = require('../models/Attendance');
const Student = require('../models/Student');
const { emitAttendanceUpdate } = require('../sockets/socketManager');

const GRACE_PERIOD_MS = 20000; // 20s grace after token expiry

exports.verifyAttendance = async (req, res) => {
  try {
    const { sessionId, detectedFrequency, selectedOptionId, rollNumber } = req.body;
    console.log(`[Verify] sessionId=${sessionId} freq=${detectedFrequency} option=${selectedOptionId} roll=${rollNumber}`);

    const session = await Session.findOne({ sessionId, isActive: true });
    if (!session) return res.status(404).json({ message: 'Session not found or already ended' });

    // Token expiry check with grace period
    const expiryWithGrace = new Date(session.expiresAt.getTime() + GRACE_PERIOD_MS);
    if (new Date() > expiryWithGrace) {
      return res.status(400).json({ message: 'Token expired. Please try again when token refreshes.' });
    }

    // Frequency match - 600Hz tolerance for different devices
    const freqDiff = Math.abs(detectedFrequency - session.tokenFrequency);
    console.log(`[Verify] freqDiff=${freqDiff} (detected=${detectedFrequency} expected=${session.tokenFrequency})`);
    if (freqDiff > 800) {
      return res.status(400).json({
        message: 'Signal not matched. Move closer to the device and retry.',
        detectedFreq: detectedFrequency,
        expectedFreq: session.tokenFrequency,
        diff: freqDiff
      });
    }

    // Pattern selection check
    if (selectedOptionId !== session.pattern.correctId) {
      return res.status(400).json({
        message: 'Wrong option selected. Look at the board carefully.',
        code: 'WRONG_SELECTION'
      });
    }

    // Find student record - search by roll number under this teacher
    const rn = rollNumber || req.user.rollNumber;
    const student = await Student.findOne({ rollNumber: rn, teacherId: session.teacherId });
    if (!student) {
      return res.status(404).json({
        message: `Student with roll number "${rn}" not found. Contact your teacher.`
      });
    }

    // Prevent duplicate attendance
    const existing = await Attendance.findOne({ sessionId, studentDbId: student._id });
    if (existing) return res.status(400).json({ message: 'Attendance already marked for this session.' });

    // Create attendance record
    const attendance = await Attendance.create({
      sessionId,
      teacherId: session.teacherId,
      studentId: req.user._id,
      studentDbId: student._id,
      class: session.class,
      subject: session.subject,
      status: 'present'
    });

    console.log(`[Verify] Attendance marked for ${student.name} in session ${sessionId}`);

    // Emit real-time update to teacher's room
    emitAttendanceUpdate(sessionId, {
      studentId: student._id.toString(),
      name: student.name,
      rollNumber: student.rollNumber,
      class: student.class,
      status: 'present',
      markedAt: attendance.markedAt
    });

    res.json({
      message: 'Attendance marked successfully!',
      attendance: {
        subject: session.subject,
        class: session.class,
        markedAt: attendance.markedAt
      }
    });
  } catch (error) {
    console.error('verifyAttendance error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getStudentAttendance = async (req, res) => {
  try {
    const { subject, class: cls, startDate, endDate } = req.query;
    const filter = { studentId: req.user._id };
    if (subject) filter.subject = subject;
    if (cls) filter.class = cls;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const records = await Attendance.find(filter).sort({ date: -1 });

    const subjectMap = {};
    records.forEach(r => {
      const key = `${r.class}||${r.subject}`;
      if (!subjectMap[key]) subjectMap[key] = { subject: r.subject, class: r.class, total: 0, present: 0 };
      subjectMap[key].total++;
      if (r.status === 'present') subjectMap[key].present++;
    });

    const subjectStats = Object.values(subjectMap).map(d => ({
      ...d,
      percentage: Math.round((d.present / d.total) * 100)
    }));

    const overall = {
      total: records.length,
      present: records.filter(r => r.status === 'present').length
    };
    overall.percentage = overall.total > 0 ? Math.round((overall.present / overall.total) * 100) : 0;

    res.json({ records, subjectStats, overall });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.exportAttendance = async (req, res) => {
  try {
    const { class: cls, subject, date } = req.query;
    const filter = { teacherId: req.user._id };
    if (cls) filter.class = cls;
    if (subject) filter.subject = subject;
    if (date) {
      const start = new Date(date); start.setHours(0,0,0,0);
      const end = new Date(date); end.setHours(23,59,59,999);
      filter.date = { $gte: start, $lte: end };
    }

    const records = await Attendance.find(filter)
      .populate('studentDbId', 'name rollNumber class')
      .sort({ date: -1 });

    const csv = ['Date,Roll No,Name,Class,Subject,Status,Time'];
    records.forEach(r => {
      const d = new Date(r.date);
      csv.push([
        d.toLocaleDateString(), r.studentDbId?.rollNumber || 'N/A',
        r.studentDbId?.name || 'N/A', r.class, r.subject,
        r.status, d.toLocaleTimeString()
      ].join(','));
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=attendance.csv');
    res.send(csv.join('\n'));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};