const mongoose = require('mongoose');
const User = require('./models/User');
const readline = require('readline');

// Prod URI template - REPLACE <db_password> with actual password
const PROD_URI = 'mongodb+srv://civicsense_user:Aliet4thcsd4438@civicsense-ai.viambc2.mongodb.net/civicsense?retryWrites=true&w=majority&appName=Civicsense-Ai';

async function resetProdUser() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Enter db_password for civicsense_user: ', async (dbPass) => {
    const uri = PROD_URI.replace('<db_password>', dbPass);
    rl.question('Enter email to reset: ', async (email) => {
      rl.question('Enter new name: ', async (name) => {
        rl.question('Enter new password: ', async (password) => {
          try {
            await mongoose.connect(uri);
            console.log('✅ Connected to PROD MongoDB (civicsense-ai cluster)');

            // Delete existing
            await User.deleteOne({ email });
            console.log('🗑️ Deleted old user');

            // Create new
            const user = new User({ name, email, password, role: 'citizen' });
            await user.save();
            console.log(`✅ PROD user reset: ${email} pw:${password}`);

            mongoose.connection.close();
            rl.close();
          } catch (err) {
            console.error('❌', err.message);
            rl.close();
          }
        });
      });
    });
  });
}

resetProdUser();

