const mongoose = require('mongoose');
const IssueReport = require('./models/IssueReport');

// Use same URI as checkUsers.js
const URI = process.env.MONGODB_URI || 'mongodb+srv://civicsense_user:Aliet4thcsd4438@civicsense-ai.viambc2.mongodb.net/civicsense?retryWrites=true&w=majority&appName=Civicsense-Ai';

async function checkIssues() {
  try {
    await mongoose.connect(URI);
    console.log('✅ Connected to DB for issues check');

    const totalCount = await IssueReport.countDocuments();
    console.log(`Total issues: ${totalCount}`);

    const byStatus = await IssueReport.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('\nStatus breakdown:');
    byStatus.forEach(stat => console.log(`${stat._id}: ${stat.count}`));

    const recent = await IssueReport.find({}).sort({createdAt: -1}).limit(5).select('title status issueType createdAt');
    console.log('\nRecent 5 issues:');
    recent.forEach((issue, i) => {
      console.log(`${i+1}. ${issue.title || 'No title'} (${issue.issueType}) - ${issue.status} - ${issue.createdAt.toLocaleDateString()}`);
    });

    mongoose.connection.close();
  } catch (err) {
    console.error('❌ Error:', err.message);
  }
}

checkIssues();
