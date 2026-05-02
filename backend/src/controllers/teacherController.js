const Student = require('../models/Student');
const Attendance = require('../models/Attendance');

exports.getStudents = async (req, res) => {
  try {
    const { class: cls } = req.query;
    const filter = { teacherId: req.user._id };
    if (cls) filter.class = cls;
    const students = await Student.find(filter).sort({ class: 1, rollNumber: 1 });
    res.json({ students });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getClasses = async (req, res) => {
  try {
    const students = await Student.find({ teacherId: req.user._id });
    const classes = [...new Set(students.map(s => s.class).filter(Boolean))].sort();
    const subjects = [...new Set(students.flatMap(s => s.subjects || []).filter(Boolean))].sort();
    res.json({ classes, subjects });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.addStudent = async (req, res) => {
  try {
    const { name, rollNumber, class: cls, subjects, email, phone } = req.body;
    if (!name || !rollNumber || !cls) {
      return res.status(400).json({ message: 'Name, roll number and class are required' });
    }
    // Check duplicate roll number under same teacher
    const existing = await Student.findOne({ rollNumber, teacherId: req.user._id });
    if (existing) return res.status(400).json({ message: `Roll number "${rollNumber}" already exists` });

    const student = await Student.create({
      name, rollNumber, class: cls,
      subjects: Array.isArray(subjects) ? subjects : (subjects ? subjects.split(',').map(s=>s.trim()) : []),
      email, phone, teacherId: req.user._id
    });
    res.status(201).json({ student });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.updateStudent = async (req, res) => {
  try {
    const update = { ...req.body };
    if (update.subjects && !Array.isArray(update.subjects)) {
      update.subjects = update.subjects.split(',').map(s => s.trim());
    }
    const student = await Student.findOneAndUpdate(
      { _id: req.params.id, teacherId: req.user._id },
      update, { new: true }
    );
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ student });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

exports.deleteStudent = async (req, res) => {
  try {
    const student = await Student.findOneAndDelete({ _id: req.params.id, teacherId: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Student deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getAnalytics = async (req, res) => {
  try {
    const { class: cls, subject, startDate, endDate } = req.query;
    const filter = { teacherId: req.user._id };
    if (cls) filter.class = cls;
    if (subject) filter.subject = subject;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const records = await Attendance.find(filter).populate('studentDbId', 'name rollNumber class');
    const studentFilter = { teacherId: req.user._id };
    if (cls) studentFilter.class = cls;
    const students = await Student.find(studentFilter);

    const statsMap = {};
    students.forEach(s => {
      statsMap[s._id.toString()] = { student: s, total: 0, present: 0 };
    });

    records.forEach(r => {
      const key = r.studentDbId?._id?.toString();
      if (key && statsMap[key]) {
        statsMap[key].total++;
        if (r.status === 'present') statsMap[key].present++;
      }
    });

    const stats = Object.values(statsMap).map(({ student, total, present }) => ({
      studentId: student._id,
      name: student.name,
      rollNumber: student.rollNumber,
      class: student.class,
      subjects: student.subjects,
      total, present,
      percentage: total > 0 ? Math.round((present / total) * 100) : 0
    }));

    res.json({ stats, total: records.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};