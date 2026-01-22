const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const JWT_SECRET = 'your_secret_key';
const sendSMS = require('../helpers/smssend')

const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// 📍 1. Send OTP for Forget PIN
router.post('/forget/send-otp', async (req, res) => {
  const { phone } = req.body;

  if (!phone) return res.status(400).json({ message: 'Phone number is required' });

  try {
    const user = await User.findOne({ phone });

    if (!user) {
    return res.status(404).json({ message: 'User not found' });
  }

  if (!user.pin && !user.password) {
    return res.status(400).json({
      message: 'No PIN or password found for this user',
    });
  }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpiresAt = expiry;
    await user.save();
     let phoneupdate = phone.replace(/\D/g, '');  // only digits
        phoneupdate = phoneupdate.replace(/^91/, ''); // remove country code
    
        await sendSMS(phoneupdate, otp);
    console.log(`🔑 Forget PIN OTP for ${phone}: ${otp}`);
    res.status(200).json({
      message: 'OTP sent successfully',
      userId: user._id,
      otp: user.otp,
    });

  } catch (err) {
    console.error('❌ forget/send-otp error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// 📍 2. Verify OTP for Forget PIN
router.post('/forget/verify-otp', async (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    return res.status(400).json({ message: 'User ID and OTP required' });
  }

  try {
    const user = await User.findById(userId);

    if (!user || user.otp !== otp || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    return res.status(200).json({
      message: 'OTP verified. You can now reset your PIN.',
      userId: user._id
    });

  } catch (err) {
    console.error('❌ forget/verify-otp error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


// 📍 3. Set New PIN after OTP verification
router.post('/forget/set-pin', async (req, res) => {
  const { userId, newPin, confirmPin } = req.body;

  if (!userId || !newPin || !confirmPin) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (newPin !== confirmPin) {
    return res.status(400).json({ message: 'PINs do not match' });
  }

  if (!/^\d{6}$/.test(newPin)) {
    return res.status(400).json({ message: 'PIN must be 6 digits' });
  }

  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.pin = await bcrypt.hash(newPin, 10);
    await user.save();

    const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '1h' });

    return res.status(200).json({
      message: 'PIN reset successful',
      token,
    });

  } catch (err) {
    console.error('❌ forget/set-pin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
