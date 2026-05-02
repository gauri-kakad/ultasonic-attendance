const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { getStudents, addStudent, updateStudent, deleteStudent, getAnalytics, getClasses } = require('../controllers/teacherController');

router.use(protect, requireRole('teacher'));
router.get('/classes', getClasses);
router.get('/students', getStudents);
router.post('/students', addStudent);
router.put('/students/:id', updateStudent);
router.delete('/students/:id', deleteStudent);
router.get('/analytics', getAnalytics);

module.exports = router;