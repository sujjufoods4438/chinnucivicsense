const express = require('express');
const router = express.Router();
const { signupUser, loginUser, loginAdmin, getCurrentUser, getLeaderboard } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public routes
router.post('/signup', signupUser);
router.post('/login', loginUser);
router.post('/admin-login', loginAdmin);
router.get('/leaderboard', getLeaderboard); // NEW

// Protected routes
router.get('/me', protect, getCurrentUser);

module.exports = router;
