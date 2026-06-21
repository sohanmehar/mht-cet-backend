const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Google details we get automatically after verified login
  googleId: {
    type: String,
    required: true,
    unique: true // 🛡️ Taaki pure database mein ek bande ki ek hi core entry ho
  },
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
    type: String // Optional: Google profile photo string save karne ke liye
  },

  // 🎯 PROFILE-LOCK PARAMETERS (Jo onboarding par save honge)
  percentile: {
    type: Number,
    default: null // Starting mein null rahega jab tak bacha input na kare
  },
  category: {
    type: String,
    default: 'GOPENS' // Default mapping target category
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);