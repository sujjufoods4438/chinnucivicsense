const mongoose = require('mongoose');
const User = require('./models/User');

// Use your PROD URI here
const URI = process.env.MONGODB_URI || 'mongodb+srv://civicsense_user:Aliet4thcsd4438@civicsense-ai.viambc2.mongodb.net/civicsense?retryWrites=true&w=majority&appName=Civicsense-Ai';

async function checkUsers() {
  try {
    await mongoose.connect(URI);
    console.log('✅ Connected to DB');

    const count = await User.countDocuments();
    console.log(`Total users: ${count}`);

const users = await User.find({}, '_id name email role createdAt');
    console.log('\\nUser List:');
    users.forEach((user, i) => {
      console.log(`${i+1}. ${user.name || 'No name'} (${user.email}) - ${user.role} - ${user.createdAt.toLocaleDateString()}`);
    });

    mongoose.connection.close();
  } catch (err) {
    console.error('❌', err.message);
  }
}

checkUsers();

