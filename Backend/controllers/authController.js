const User = require('../models/User');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || process.env.jwt_secret;

const signAuthToken = (payload) => {
  if (!JWT_SECRET) {
    throw new Error('JWT secret is not configured');
  }

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
};

// Register User (Signup)
exports.signupUser = async (req, res) => {
  try {
    let { name, email, password, confirmPassword } = req.body;

    // Validation
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ success: false, message: 'Please provide all required fields' });
    }

    if (email) email = email.trim().toLowerCase();

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, message: 'Passwords do not match' });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    user = new User({
      name,
      email,
      password,
      role: 'citizen'
    });

    await user.save();

    // Generate token
    const token = signAuthToken({ id: user._id, email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Login User
exports.loginUser = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (email) email = email.trim().toLowerCase();

    // Validation
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    let user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate token
    const token = signAuthToken({ id: user._id, email: user.email, role: user.role });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin Login
exports.loginAdmin = async (req, res) => {
  try {
    let { email, password } = req.body;
    if (email) email = email.trim().toLowerCase();

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    // Try fetching admin from database first
    let user = await User.findOne({ email, role: 'admin' }).select('+password');

    let isValid = false;
    let userId = 'admin';
    let userName = 'Admin';

    if (user) {
      // Check database credentials
      isValid = await user.matchPassword(password);
      if (isValid) {
        userId = user._id;
        userName = user.name || 'Admin';
      }
    }

    // Fallback to .env admin credentials if not found in DB
    if (!isValid && email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD) {
      isValid = true;
    }

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
    }

    // Generate token for admin
    const token = signAuthToken({ id: userId, email: email, role: 'admin' });

    res.status(200).json({
      success: true,
      token,
      user: {
        id: userId,
        name: userName,
        email: email,
        role: 'admin'
      }

    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get current user
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Get leaderboard
exports.getLeaderboard = async (req, res) => {
  try {
    const topUsers = await User.find({ role: 'citizen' })
      .select('name points badges')
      .sort({ points: -1 })
      .limit(10);
      
    res.status(200).json({
      success: true,
      data: topUsers
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
