const mongoose = require('mongoose');

const issueReportSchema = new mongoose.Schema({
  reportedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  issueType: {
    type: String,
    enum: ['pothole', 'garbage', 'streetlight', 'damaged_road', 'water_leak', 'other'],
    required: [true, 'Please specify issue type']
  },
  description: {
    type: String,
    required: [true, 'Please provide issue description'],
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  image: {
    type: String,
    default: null
  },
  location: {
    streetName: {
      type: String,
      required: [true, 'Please provide street name']
    },
    area: {
      type: String,
      required: [true, 'Please provide area']
    },
    city: {
      type: String,
      required: [true, 'Please provide city']
    },
    district: {
      type: String,
      required: [true, 'Please provide district']
    },
    state: {
      type: String,
      required: [true, 'Please provide state']
    },
    municipality: {
      type: String,
      required: [true, 'Please provide municipality']
    },
    latitude: {
      type: Number,
      default: null
    },
    longitude: {
      type: Number,
      default: null
    }
  },
  status: {
    type: String,
    enum: ['reported', 'in_progress', 'resolved', 'rejected'],
    default: 'reported'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  resolutionDate: {
    type: Date,
    default: null
  },
  comments: {
    type: String,
    default: null
  },
  votes: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('IssueReport', issueReportSchema);
