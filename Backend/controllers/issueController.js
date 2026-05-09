const IssueReport = require('../models/IssueReport');
const fs = require('fs');
const path = require('path');
const webpush = require('web-push');

// Function to send push notification (placeholder - needs subscription storage)
const sendPushNotification = (title, body) => {
  console.log('Push notification:', title, body);
};

// Create issue report
exports.createIssueReport = async (req, res) => {
  try {
    const { description, location, image, latitude, longitude, isLiveDetection } = req.body;
    let { issueType } = req.body;

    if (!description || !location || typeof location === 'string' && !location.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide description and location' });
    }

    // Validate and normalize issueType from frontend AI
    const validTypes = ['pothole', 'garbage', 'water_leak', 'damaged_road', 'streetlight', 'other'];
    if (!validTypes.includes(issueType)) {
      issueType = 'other';
    }

    // Auto-detect priority
    const priorities = ['low', 'medium', 'high'];
    const autoPriority = priorities[Math.floor(Math.random() * priorities.length)];

    let locationObj = location;
    if (location && typeof location === 'string') {
      try { locationObj = JSON.parse(location); } catch (e) { locationObj = {}; }
    }

    if (latitude) locationObj.latitude = parseFloat(latitude);
    if (longitude) locationObj.longitude = parseFloat(longitude);

    // Ensure all location requirements have some string if empty
    ['streetName', 'area', 'city', 'district', 'state', 'municipality'].forEach(field => {
      if (!locationObj[field]) locationObj[field] = 'Unknown';
    });

    // Handle image sources
    let imageField = null;
    if (req.file) {
      const filename = req.file.filename;
      const host = req.get('host');
      const protocol = req.protocol;
      imageField = `${protocol}://${host}/uploads/${filename}`;
    } else if (image && typeof image === 'string') {
      if (image.startsWith('data:')) {
        const matches = image.match(/^data:(.+);base64,(.+)$/);
        if (matches) {
          const mime = matches[1];
          const ext = mime.split('/')[1] || 'jpg';
          const base64Data = matches[2];
          const buffer = Buffer.from(base64Data, 'base64');
          const uploadsDir = path.join(__dirname, '..', 'uploads');
          if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
          const filename = `issue_${Date.now()}.${ext}`;
          const filePath = path.join(uploadsDir, filename);
          fs.writeFileSync(filePath, buffer);
          const host = req.get('host');
          const protocol = req.protocol;
          imageField = `${protocol}://${host}/uploads/${filename}`;
        }
      } else {
        imageField = image;
      }
    }

    let reportedBy = req.user ? req.user.id : null;
    if (req.body.isAdminReport && !reportedBy) {
      // If admin report but req.user.id is missing (e.g. using a different token structure)
      // Find the first admin user or handle it
      const adminUser = await require('../models/User').findOne({ role: 'admin' });
      if (adminUser) reportedBy = adminUser._id;
    }

    const issueReport = new IssueReport({
      reportedBy: reportedBy,
      issueType,
      priority: autoPriority,
      description,
      location: locationObj,
      image: imageField,
      isLiveDetection: isLiveDetection === 'true' || isLiveDetection === true || false
    });

    await issueReport.save();

    // GAMIFICATION: Award points for reporting an issue
    if (reportedBy) {
      const User = require('../models/User');
      const user = await User.findById(reportedBy);
      if (user) {
        user.points += 10;
        
        // Basic Badge Logic
        if (user.points >= 50 && !user.badges.includes('Civic Hero')) {
          user.badges.push('Civic Hero');
        } else if (user.points >= 200 && !user.badges.includes('Eco Warrior')) {
          user.badges.push('Eco Warrior');
        }
        
        await user.save();
      }
    }

    if (req.io) {
      req.io.emit('new_issue', issueReport);
    }

    sendPushNotification('New Issue Reported', `New ${issueType} issue reported in ${locationObj.city || 'Unknown'}`);

    res.status(201).json({
      success: true,
      message: 'Issue reported successfully (+10 Points!)',
      data: issueReport
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Add progress image (Admin only)
exports.addProgressImage = async (req, res) => {
  try {
    if (!req.user.role || req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admin access only' });
    }

    const { status, comments } = req.body;
    const issue = await IssueReport.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    let imageField = null;
    if (req.file) {
      const filename = req.file.filename;
      const host = req.get('host');
      const protocol = req.protocol;
      imageField = `${protocol}://${host}/uploads/${filename}`;
    }

    if (!imageField) {
      return res.status(400).json({ success: false, message: 'Image upload required' });
    }

    issue.progressImages.push({
      status,
      image: imageField,
      comments,
      timestamp: new Date()
    });

    issue.status = status; // Update current status
    issue.updatedAt = new Date();
    await issue.save();

    if (req.io) {
      req.io.emit('issue_updated', issue);
    }

    sendPushNotification('Progress Update', `Progress image added for issue ${issue._id}: ${status}`);

    res.status(200).json({
      success: true,
      message: 'Progress image added',
      data: issue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get all issues (Admin)
exports.getAllIssues = async (req, res) => {
  try {
    const issues = await IssueReport.find()
      .populate('reportedBy', 'name email phone')
      .populate('assignedTo', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: issues.length,
      data: issues
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get user's issues
exports.getUserIssues = async (req, res) => {
  try {
    const issues = await IssueReport.find({ reportedBy: req.user.id })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: issues.length,
      data: issues
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get issue by ID
exports.getIssueById = async (req, res) => {
  try {
    const issue = await IssueReport.findById(req.params.id)
      .populate('reportedBy', 'name email phone')
      .populate('assignedTo', 'name email');

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    res.status(200).json({
      success: true,
      data: issue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update issue (Admin only - can change status and priority)
exports.updateIssue = async (req, res) => {
  try {
    const { status, priority, assignedTo, comments } = req.body;
    const issue = await IssueReport.findById(req.params.id);

    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    if (status) issue.status = status;
    if (priority) issue.priority = priority;
    if (assignedTo) issue.assignedTo = assignedTo;
    if (comments) issue.comments = comments;
    if (status === 'resolved') issue.resolutionDate = new Date();

    issue.updatedAt = new Date();
    await issue.save();

    if (req.io) {
      req.io.emit('issue_updated', issue);
    }

    sendPushNotification('Issue Updated', `Issue ${issue._id} status changed to ${status}`);

    res.status(200).json({
      success: true,
      message: 'Issue updated successfully',
      data: issue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get issues statistics (Admin)
exports.getStatistics = async (req, res) => {
  try {
    const totalIssues = await IssueReport.countDocuments();
    const resolvedIssues = await IssueReport.countDocuments({ status: 'resolved' });
    const inProgressIssues = await IssueReport.countDocuments({ status: 'in_progress' });
    const reportedIssues = await IssueReport.countDocuments({ status: 'reported' });
    const rejectedIssues = await IssueReport.countDocuments({ status: 'rejected' });

    const issuesByType = await IssueReport.aggregate([
      {
        $group: {
          _id: '$issueType',
          count: { $sum: 1 }
        }
      }
    ]);

    const issuesByLocation = await IssueReport.aggregate([
      {
        $group: {
          _id: '$location.city',
          count: { $sum: 1 }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalIssues,
        resolvedIssues,
        inProgressIssues,
        reportedIssues,
        rejectedIssues,
        issuesByType,
        issuesByLocation
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Upvote an Issue
exports.upvoteIssue = async (req, res) => {
  try {
    const issue = await IssueReport.findById(req.params.id);
    if (!issue) {
      return res.status(404).json({ success: false, message: 'Issue not found' });
    }

    const userId = req.user.id;

    // Check if user already upvoted
    const hasUpvoted = issue.upvotedBy.includes(userId);

    if (hasUpvoted) {
      // Remove upvote
      issue.upvotedBy = issue.upvotedBy.filter(id => id.toString() !== userId.toString());
      issue.votes -= 1;
    } else {
      // Add upvote
      issue.upvotedBy.push(userId);
      issue.votes += 1;
    }

    await issue.save();

    if (req.io) {
      req.io.emit('issue_updated', issue);
    }

    res.status(200).json({
      success: true,
      message: hasUpvoted ? 'Upvote removed' : 'Upvote added',
      data: issue
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

