const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function deleteAllUsers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const result = await User.deleteMany({});
    console.log(`🗑️ Deleted ${result.deletedCount} users`);

    mongoose.connection.close();
    console.log('✅ All users deleted');
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

deleteAllUsers();
