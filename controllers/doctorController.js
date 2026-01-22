
const bcrypt = require('bcryptjs');
const HospitalUser = require('../models/HospitalUser');

// OTP generate function
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

exports.sendOtpWithDetails = async (req, res) => {
  const { name, phone, password } = req.body;

  if (!name || !phone || !password) {
    return res.status(400).json({ message: 'name, phone, and password are required' });
  }

  try {
    const existingUser = await HospitalUser.findOne({ phone });

    if (existingUser && existingUser.isVerified) {
      return res.status(409).json({
        message: 'User already exists. Please sign in or use a different number.'
      });
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    let user;

    if (!existingUser) {
      const hashedPassword = await bcrypt.hash(password, 10);
      user = new HospitalUser({
        name,
        phone,
        password: hashedPassword,
        otp,
        otpExpiresAt: expiry
      });
    } else {
      // Update name/password if needed
      existingUser.name = name;
      existingUser.password = await bcrypt.hash(password, 10);
      existingUser.otp = otp;
      existingUser.otpExpiresAt = expiry;
      user = existingUser;
    }

    await user.save();

    console.log(`OTP for ${phone}: ${otp}`);
    console.log(`User ID: ${user._id}`);

    res.status(200).json({
      message: 'OTP sent successfully',
      otp,
      userId: user._id,
      phone: user.phone,
      name: user.name
    });
  } catch (err) {
    console.error('❌ sendOtpWithDetails error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

exports.verifyOtpWithDetails = async (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp) {
    return res.status(400).json({ message: 'User ID and OTP are required' });
  }

  try {
    const user = await HospitalUser.findById(userId);

    if (!user || user.otp !== otp || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiresAt = null;

    await user.save();

    res.status(200).json({
      message: 'OTP verified successfully.',
      userId: user._id,
      phone: user.phone,
      name: user.name
    });
  } catch (err) {
    console.error('❌ verifyOtpWithDetails error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};
