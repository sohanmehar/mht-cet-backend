const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Preference = require('../models/Preference');

// @route   GET /api/preferences
// @desc    Get currently logged-in user's preference list strictly from Cloud DB
router.get('/', auth, async (req, res) => {
  try {
    const pref = await Preference.findOne({ userId: req.user.id });
    if (!pref) {
      // Agar cloud par koi data nahi hai toh empty list bhejo (jaise pure new user ke liye)
      return res.status(200).json({ success: true, data: [] });
    }
    return res.status(200).json({ success: true, data: pref.choices });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Cloud fetch error.' });
  }
});

// @route   POST /api/preferences/sync
// @desc    Save/Sync entire preference list to Cloud MongoDB
router.post('/sync', auth, async (req, res) => {
  const { choices } = req.body;
  try {
    let pref = await Preference.findOne({ userId: req.user.id });
    
    if (pref) {
      // Agar pehle se list hai toh overwrite/update kar do new states se
      pref.choices = choices;
      pref.updatedAt = Date.now();
    } else {
      // Naya user hai toh database mein pehli fresh preference entry banao
      pref = new Preference({
        userId: req.user.id,
        choices
      });
    }
    await pref.save();
    return res.status(200).json({ success: true, message: 'Preferences synced to Cloud!' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Cloud synchronization failed.' });
  }
});

module.exports = router;