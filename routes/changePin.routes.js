const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const authMiddleware = require('../middleware/auth.middleware');


router.post('/', authMiddleware, async (req, res) => {
  const { oldPin, password, newPin, confirmPin } = req.body;

  let userId;

  if (oldPin) {
    userId = req.user.userId;
  }

  else if (password) {
    userId = req.headers.userid;
    if (!userId) {
      return res.status(400).json({
        message: 'UserId required when setting PIN using password',
      });
    }
  }

  else {
    return res.status(400).json({
      message: 'Either oldPin or password is required',
    });
  }

  if (!newPin || !confirmPin) {
    return res.status(400).json({ message: 'New PIN fields are required' });
  }

  if (newPin !== confirmPin) {
    return res.status(400).json({ message: 'New PINs do not match' });
  }

  if (!/^\d{6}$/.test(newPin)) {
    return res.status(400).json({ message: 'New PIN must be 6 digits' });
  }

  try {
    const user = await User.findById(userId).select('pin password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (oldPin) {
      const isMatch = await bcrypt.compare(oldPin, user.pin);
      if (!isMatch) {
        return res.status(400).json({ message: 'Old PIN is incorrect' });
      }
    }

    if (password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: 'Password is incorrect' });
      }
    }

    user.pin = await bcrypt.hash(newPin, 12);
    await user.save();

    return res.status(200).json({
      message: oldPin ? 'PIN changed successfully' : 'PIN set successfully',
    });

  } catch (err) {
    console.error('❌ change/set pin error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});


router.post('/no-auth', async (req, res) => {
  const { oldPin, password, newPin, confirmPin } = req.body;
  const userId = req.headers.userid;

  if (!userId) {
    return res.status(400).json({
      message: 'UserId is required in header',
    });
  }

  if (!oldPin && !password) {
    return res.status(400).json({
      message: 'Either oldPin or password is required',
    });
  }

  if (!newPin || !confirmPin) {
    return res.status(400).json({
      message: 'New PIN and Confirm PIN are required',
    });
  }

  if (newPin !== confirmPin) {
    return res.status(400).json({
      message: 'New PINs do not match',
    });
  }

  if (!/^\d{6}$/.test(newPin)) {
    return res.status(400).json({
      message: 'New PIN must be exactly 6 digits',
    });
  }

  try {
    const user = await User.findById(userId).select('pin password');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    if (oldPin) {
      if (!user.pin) {
        return res.status(400).json({
          message: 'PIN not set for this user',
        });
      }

      const isPinMatch = await bcrypt.compare(oldPin, user.pin);
      if (!isPinMatch) {
        return res.status(400).json({
          message: 'Old PIN is incorrect',
        });
      }
    }

    if (password) {
      if (!user.password) {
        return res.status(400).json({
          message: 'Password not set for this user',
        });
      }

      const isPasswordMatch = await bcrypt.compare(password, user.password);
      if (!isPasswordMatch) {
        return res.status(400).json({
          message: 'Password is incorrect',
        });
      }
    }

    user.pin = await bcrypt.hash(newPin, 12);
    await user.save();

    return res.status(200).json({
      message: oldPin ? 'PIN changed successfully' : 'PIN set successfully',
    });

  } catch (error) {
    console.error('❌ Change PIN without auth error:', error);
    return res.status(500).json({
      message: 'Server error',
    });
  }
});

module.exports = router;
