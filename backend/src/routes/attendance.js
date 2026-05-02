const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { verifyAttendance, getStudentAttendance, exportAttendance } = require('../controllers/attendanceController');

router.post('/verify', protect, verifyAttendance);
router.get('/my', protect, getStudentAttendance);
router.get('/export', protect, exportAttendance);

module.exports = router;