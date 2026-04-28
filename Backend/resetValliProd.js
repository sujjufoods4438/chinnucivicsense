const mongoose = require('mongoose');
const User = require('./models/User');
require('dotenv').config();

async function resetValliProd() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to PROD MongoDB');

    // Delete existing
    await User.deleteOne({ email: 'valli243@gmail.com' });
    console.log('🗑️ Deleted valli243@gmail.com');

    // Create new
    const user = new User({ 
      name: 'Valli', 
      email: 'valli243@gmail.com', 
      password: 'valli123', 
      role: 'citizen' 
    });
    await user.save();
    console.log('✅ PROD user valli243@gmail.com created, password: valli123');

    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

resetValliProd();

