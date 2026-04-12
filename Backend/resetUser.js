const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function resetChanduUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Delete existing user
    const deleted = await User.deleteOne({ email: 'chandu@gmail.com' });
    console.log('🗑️', deleted.deletedCount === 1 ? 'Deleted existing user' : 'No user found');

    // Create new user
    const newUser = new User({
      name: 'Chandu',
      email: 'chandu@gmail.com',
      password: '8885856060', // Will be hashed
      role: 'citizen'
    });
    await newUser.save();
    console.log('✅ Created new user with password 8885856060');

    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

resetChanduUser();

