const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');

router.use(protect, requireRole('student'));

// Student-specific data routes can be added here
router.get('/profile', (req, res) => res.json({ user: req.user }));

module.exports = router;