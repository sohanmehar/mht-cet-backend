const mongoose = require('mongoose');

const preferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true // 🛡️ Ek user ki database mein sirf ek hi isolated preference list hogi
  },
  choices: [
    {
      collegeCode: { type: String, required: true },
      collegeName: { type: String, required: true },
      branchCode: { type: String, required: true },
      branchName: { type: String, required: true },
      city: { type: String },
      status: { type: String },
      recommendationType: { type: String }
    }
  ],
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Preference', preferenceSchema);