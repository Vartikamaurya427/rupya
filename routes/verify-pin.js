const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth.middleware');


router.post('/', authMiddleware, async (req, res) => {
  const { pin } = req.body;
  const userId = req.user.userId;

  if (!pin || !/^\d{6}$/.test(pin)) {
    return res.status(400).json({ message: 'Valid 6-digit PIN is required' });
  }

  try {
    const user = await User.findById(userId);

    if (!user || !user.pin) {
      return res.status(404).json({ message: 'User not found or PIN not set' });
    }

    const isMatch = await bcrypt.compare(pin, user.pin);
    if (!isMatch) {
      return res.status(400).json({ message: 'Incorrect PIN' });
    }

    return res.status(200).json({ message: 'PIN verified successfully' });

  } catch (err) {
    console.error('❌ verify-pin error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
