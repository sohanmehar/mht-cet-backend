const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// -------------------------------------------------------------------------
// 1. 📝 SIGNUP ROUTE: Creates account & triggers Brevo verification OTP
// -------------------------------------------------------------------------
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) {
      return res.status(400).json({ success: false, message: 'User already exists. Please login or use a different email.' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = Date.now() + 10 * 60 * 1000;

    user = new User({
      name,
      email: email.toLowerCase(),
      password: hashedPassword,
      otpCode: otp,
      otpExpires,
      isVerified: false
    });
    
    await user.save();

    // Trigger email notification system loop
    try {
      await sendEmail({
        email: email.toLowerCase(),
        subject: 'MHT-CET Suite Registry Activation Key',
        otp: otp
      });
      
      return res.status(201).json({ success: true, message: 'Verification OTP blasted to your email mailbox!' });

    } catch (mailErr) {
      // 🔥 FAILSAFE RECOVERY: Agar cloud server authentication fail karega, toh hum live terminal par fallback de denge!
      console.log("\n==================================================");
      console.log(`⚠️ SMTP DELIVER DROP, BUT LOCAL RECOVERY TRIGGERED!`);
      console.log(`🎯 TARGET CADET: ${email}`);
      console.log(`🔑 LIVE ACTIVATION OTP CODE: ${otp}`);
      console.log("==================================================\n");

      // Frontend ko success respond kar do taaki screen seamlessly OTP mode par slide ho jaye!
      return res.status(201).json({ 
        success: true, 
        message: 'SMTP network drop fallback active. Catch code fetched inside backend compiler console log terminal!' 
      });
    }

  } catch (err) {
    return res.status(500).json({ success: false, message: 'Internal registry script runtime crash.' });
  }
});

// -------------------------------------------------------------------------
// 2. ⚡ VERIFY OTP ROUTE: Validates code & unlocks account space
// -------------------------------------------------------------------------
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User parameters missing.' });
    }

    // Scrutiny checks for time expiration or code variations
    if (user.otpCode !== otp || Date.now() > user.otpExpires) {
      return res.status(400).json({ success: false, message: 'Invalid or expired activation token.' });
    }

    // Wipe token tracing from entity space and permanently unlock account
    user.isVerified = true;
    user.otpCode = null;
    user.otpExpires = null;
    await user.save();

    // Sign dynamic authentication web token session
    const token = jwt.sign({ id: user._index || user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        percentile: user.percentile,
        category: user.category
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'OTP handshake script failure.' });
  }
});

// -------------------------------------------------------------------------
// 3. 🔑 LEGACY LOGIN ROUTE: standard Email + Password session validation
// -------------------------------------------------------------------------
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid parameters matching matrix.' });
    }

    // Google Sign-In check fallback bypass block
    if (!user.password && user.googleId) {
      return res.status(400).json({ success: false, message: 'Account registered via Google Identity Grid. Click Google Sign-In.' });
    }

    // Freeze access if email is not verified yet
    if (!user.isVerified) {
      return res.status(403).json({ success: false, message: 'Account registry is locked. Complete OTP verification layer first.' });
    }

    // Compare credential decryption variables
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid parameters matching matrix.' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        percentile: user.percentile,
        category: user.category
      }
    });

  } catch (err) {
    return res.status(500).json({ success: false, message: 'System credential audit offline.' });
  }
});

// -------------------------------------------------------------------------
// 4. 🌐 Existing GOOGLE OAUTH ROUTE (kept as is for seamless legacy integration)
// -------------------------------------------------------------------------
router.post('/google', async (req, res) => {
  const { idToken } = req.body;
  try {
    const ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture: avatar } = payload;

    let user = await User.findOne({ email: email.toLowerCase() });

    if (user) {
      if (!user.googleId) {
        user.googleId = googleId;
        if (!user.avatar) user.avatar = avatar;
        await user.save();
      }
    } else {
      user = new User({
        name,
        email: email.toLowerCase(),
        avatar,
        googleId,
        isVerified: true // Google accounts bypass OTP because they are pre-verified by Alphabet network
      });
      await user.save();
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({
      success: true,
      token,
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
    console.error("Google verify token failure:", err);
    res.status(400).json({ success: false, message: 'Google identification token dropped.' });
  }
});

// -------------------------------------------------------------------------
// 🚀 PROFILE ONBOARDING LAYER: Locks Profile Attributes & Metrics
// -------------------------------------------------------------------------
router.put('/onboard-profile', async (req, res) => {
  const { email, mobileNumber, district, percentile, category } = req.body;
  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(400).json({ success: false, message: 'User mapping parameters missing.' });
    }

    // Update the profile configuration fields
    user.mobileNumber = mobileNumber;
    user.district = district;
    user.percentile = parseFloat(percentile);
    user.category = category;
    user.isOnboarded = true; // Mark onboarding session complete!

    await user.save();

    return res.status(200).json({
      success: true,
      message: 'Onboarding matrix successfully locked!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        mobileNumber: user.mobileNumber,
        district: user.district,
        percentile: user.percentile,
        category: user.category,
        isOnboarded: user.isOnboarded
      }
    });

  } catch (err) {
    console.error("Onboarding endpoint failure:", err);
    return res.status(500).json({ success: false, message: 'Onboarding pipeline processing crash.' });
  }
});

module.exports = router;