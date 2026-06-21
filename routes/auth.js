const express = require('express');
const router = express.Router();
const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Google OAuth Client Initialize using variables from .env
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// @route   POST /api/auth/google
// @desc    Verify Google ID Token and login/register student securely
router.post('/google', async (req, res) => {
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ success: false, message: 'Google identification token is missing.' });
  }

  try {
    // 1. Google Server verification channel directly
    const ticket = await client.verifyIdToken({
      idToken: idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    // Extract user meta-payload securely from verified ticket
    const payload = ticket.getPayload();
    const { sub: googleId, name, email, picture: avatar } = payload;

    // 2. Database validation layer logic
    let user = await User.findOne({ googleId });

    if (!user) {
      // Create user if signing up for the first time
      user = new User({
        googleId,
        name,
        email,
        avatar
      });
      await user.save();
    }

    // 3. Session security allocation with custom JSON Web Token
    const jwtToken = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' } // Session valid for 7 days
    );

    // 4. Return secure envelope wrapper packet
    return res.status(200).json({
      success: true,
      message: 'Authentication token verified safely.',
      token: jwtToken,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        percentile: user.percentile, // 👈 Profile lock tracking
        category: user.category
      }
    });

  } catch (err) {
    console.error("OAuth token payload intercept error:", err);
    return res.status(401).json({ success: false, message: 'Google security handshake verification failed.' });
  }
});

// @route   PUT /api/auth/update-profile
// @desc    Lock student's baseline percentile and category profile data permanently
router.put('/update-profile', auth, async (req, res) => {
  const { percentile, category } = req.body;

  try {
    // Find user by unique ID extracted strictly from verified JWT token payload
    let user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User account profile lookup failed.' });
    }

    // Overwrite database profile settings metrics
    if (percentile !== undefined) user.percentile = parseFloat(percentile);
    if (category !== undefined) user.category = category;

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Profile constraints locked into cloud server successfully.',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        percentile: user.percentile,
        category: user.category
      }
    });

  } catch (err) {
    console.error("Profile update sync crash:", err);
    return res.status(500).json({ success: false, message: 'Server database error during profile storage.' });
  }
});

// @route   GET /api/auth/me
// @desc    Get current logged-in user details via token (On page refresh safety hydration)
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-googleId');
    if (!user) return res.status(404).json({ success: false, message: 'Profile mismatch.' });
    
    return res.status(200).json({ success: true, user });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Token verification error.' });
  }
});

module.exports = router;