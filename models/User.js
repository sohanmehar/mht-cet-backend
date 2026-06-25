const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Core Identifiers
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  avatar: {
    type: String
  },

  // 🔓 OAUTH IDENTITY LAYER
  googleId: {
    type: String,
    unique: true,
    sparse: true
  },

  // 🔑 LOCAL REGISTRATION SECURE FIELDS
  password: {
    type: String,
    required: function() { return !this.googleId; }
  },

  // 🎯 ENTERPRISE OTP VERIFICATION CHANNEL
  isVerified: {
    type: Boolean,
    default: false
  },
  otpCode: {
    type: String,
    default: null
  },
  otpExpires: {
    type: Date,
    default: null
  },

  // 👤 NEW: EXTENDED PROFILE ATTRIBUTES (ONBOARDING)
  mobileNumber: {
    type: String,
    default: null
  },
  district: {
    type: String,
    default: null
  },

  // 📊 MHT-CET METRICS
  percentile: {
    type: Number,
    default: null
  },
  category: {
    type: String,
    default: 'GOPENS'
  },
  
  // ⚙️ ONBOARDING STATUS TRACKING
  isOnboarded: {
    type: Boolean,
    default: false // Jab tak bacha dono steps complete nahi karega, yeh false rahega
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);