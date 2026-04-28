const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function resetSaiUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Delete existing
    await User.deleteOne({ email: 'saibhaskar@gmail.com' });
    console.log('🗑️ Deleted old sai user');

    // Create new
    const newUser = new User({
      name: 'sai',
      email: 'saibhaskar@gmail.com',
      password: '8885856060',
      role: 'citizen'
    });
    await newUser.save();
    console.log('✅ Reset sai user - pw: 8885856060');

    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

resetSaiUser();

