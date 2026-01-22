const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('phone name email dob address aadhar profileImage pin password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let authType = 'none';
    if (user.pin && user.pin.trim() !== '') {
      authType = 'pin';
    } else if (user.password && user.password.trim() !== '') {
      authType = 'password';
    }

    res.json({
      phone: user.phone,
      name: user.name || '',
      email: user.email || '',
      dob: user.dob || '',
      address: user.address || '',
      aadhar: user.aadhar || '',
      profileImage: user.profileImage || 'no_image',
      authType,
    });

  } catch (err) {
    console.error("❌ GET /profile error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});



// ✅ UPDATE Profile
router.put('/', authMiddleware, async (req, res) => {
  try {
    const { name, email, dob, address, aadhar, profileImage } = req.body;
    const user = await User.findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (name) user.name = name;
    if (email) user.email = email;
    if (dob) user.dob = dob;
    if (address) user.address = address;
    if (aadhar) user.aadhar = aadhar;
    if (profileImage) {
  const buffer = Buffer.from(profileImage, 'base64');
  const uploadsDir = path.join(__dirname, '..', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

  const fileName = `${user._id}_${Date.now()}.png`;
  const filePath = path.join(uploadsDir, fileName);
  fs.writeFileSync(filePath, buffer);
 
  user.profileImage = `uploads/${fileName}`;
}


    await user.save();

    res.json({
      message: 'Profile updated successfully',
      user: {
        id: user._id,
        phone: user.phone,
        name: user.name,
        email: user.email,
        dob: user.dob,
        address: user.address,
        aadhar: user.aadhar,
        profileImage: user.profileImage, 
      }
    });
  } catch (err) {
    console.error("❌ PUT /profile error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
