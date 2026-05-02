const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { startSession, endSession, getActiveSession, getLiveAttendance } = require('../controllers/sessionController');

router.post('/start', protect, requireRole('teacher'), startSession);
router.put('/:sessionId/end', protect, requireRole('teacher'), endSession);
router.get('/active', protect, requireRole('teacher'), getActiveSession);
router.get('/:sessionId/attendance', protect, getLiveAttendance);

module.exports = router;