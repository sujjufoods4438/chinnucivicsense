const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
// multer storage + file validation
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '..', 'uploads'));
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `issue_${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (!file.mimetype.startsWith('image/')) {
    return cb(new Error('Only image files are allowed'), false);
  }
  cb(null, true);
};

const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });
const {
  createIssueReport,
  getAllIssues,
  getUserIssues,
  getIssueById,
  updateIssue,
  getStatistics,
  addProgressImage,
  upvoteIssue
} = require('../controllers/issueController');
const { protect, authorize } = require('../middleware/auth');

// User routes
router.post('/', protect, upload.single('image'), createIssueReport); // Create issue (accept file field `image`)
router.get('/user/my-issues', protect, getUserIssues); // Get user's issues
router.get('/stats/dashboard', protect, authorize('admin'), getStatistics); // Get statistics

// Public routes
router.get('/:id', getIssueById); // Get issue by ID
router.post('/:id/upvote', protect, upvoteIssue); // Upvote issue

// Admin routes
router.get('/', protect, authorize('admin'), getAllIssues); // Get all issues
router.put('/:id', protect, authorize('admin'), updateIssue); // Update issue
router.post('/:id/progress', protect, authorize('admin'), upload.single('image'), addProgressImage); // Add progress image

module.exports = router;
