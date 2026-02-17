const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const JWT_SECRET = 'your_secret_key';
const authMiddleware = require('../middleware/auth.middleware');
// const LoginHistory = require('../models/LoginHistory');
const { trackLogin } = require("../helpers/loginTracker");

const sendSMS = require('../helpers/smssend')
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

var admin = require("firebase-admin");

const fs = require('fs');
const path = require('path');

const firebaseFilePath = path.join(__dirname, '../firebase_service_account.json');

if (!fs.existsSync(firebaseFilePath)) {
  const base64 = process.env.FIREBASE_CONFIG_BASE64;
  if (!base64) {
    throw new Error("FIREBASE_CONFIG_BASE64 not set in environment variables");
  }
  const jsonContent = Buffer.from(base64, 'base64').toString('utf-8');
  fs.writeFileSync(firebaseFilePath, jsonContent);
}

const serviceAccount = require(firebaseFilePath);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

async function sendPushNotification(fcmToken, title, body) {
  const message = {
    notification: {
      title,
      body,
    },
    token: fcmToken,
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('✅ Notification sent:', response);
  } catch (error) {
    console.error('❌ Error sending notification:', error);
  }
}


router.post('/send-otp', async (req, res) => {
  const { phone, name, email, dob, address, reference } = req.body;

    if (!phone) {
    return res.status(400).json({ message: "Phone number required" });
  }

  try {
    const existingUser = await User.findOne({ phone });

    if (existingUser && existingUser.pin) {
      return res.status(409).json({
        message:
          "User already exists. Please sign in or use a different number.",
      });
    }

    const otp = generateOTP();
    const expiry = new Date(Date.now() + 5 * 60 * 1000);

    let user;

    if (!existingUser) {
      user = new User({
        phone,
        name,
        email,
        dob,
        address,
        otp,
        reference,
        otpExpiresAt: expiry,
      });
    } else {
      user = existingUser;
      user.otp = otp;
      user.otpExpiresAt = expiry;
      user.reference = reference;
    }

    await user.save();
    let phoneupdate = phone.replace(/\D/g, ""); // only digits
    phoneupdate = phoneupdate.replace(/^91/, ""); // remove country code
   
  if (req.reference !=="hms"){

  
    await sendSMS(phoneupdate, otp);
  }
    console.log(`OTP for ${phone}: ${otp}`);
    console.log(`User ID: ${user._id}`);

    res.status(200).json({
      message: "OTP sent successfully",
      otp,
      userId: user._id,
      phone: user.phone,
    });
  } catch (err) {
    console.error("❌ send-otp error:", err);
    res.status(500).json({ message: "Server error" });
  }
});



// const sentotp = async (req, res) => {
//   const { phone, name, email, dob, address } = req.body;

//   if (!phone) {
//     return res.status(400).json({ message: "Phone number required" });
//   }

//   try {
//     const existingUser = await User.findOne({ phone });

//     if (existingUser && existingUser.pin) {
//       return res.status(409).json({
//         message:
//           "User already exists. Please sign in or use a different number.",
//       });
//     }

//     const otp = generateOTP();
//     const expiry = new Date(Date.now() + 5 * 60 * 1000);

//     let user;

//     if (!existingUser) {
//       user = new User({
//         phone,
//         name,
//         email,
//         dob,
//         address,
//         otp,
//         otpExpiresAt: expiry,
//       });
//     } else {
//       user = existingUser;
//       user.otp = otp;
//       user.otpExpiresAt = expiry;
//     }

//     await user.save();
//     let phoneupdate = phone.replace(/\D/g, ""); // only digits
//     phoneupdate = phoneupdate.replace(/^91/, ""); // remove country code
   
//   if (req.reference !=="hms"){

  
//     await sendSMS(phoneupdate, otp);
//   }
//     console.log(`OTP for ${phone}: ${otp}`);
//     console.log(`User ID: ${user._id}`);

//     res.status(200).json({
//       message: "OTP sent successfully",
//       otp,
//       userId: user._id,
//       phone: user.phone,
//     });
//   } catch (err) {
//     console.error("❌ send-otp error:", err);
//     res.status(500).json({ message: "Server error" });
//   }
// };

router.post('/verify-otp', async (req, res) => {
  const { userId, otp } = req.body;

  if (!userId || !otp)
    return res.status(400).json({ message: 'OTP is required' });

  try {
    const user = await User.findById(userId);

    if (!user || user.otp !== otp || user.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'Invalid or expired OTP' });
    }

    user.isVerified = true;
    user.otp = null;
    user.otpExpiresAt = null;
    await user.save();

    res.status(200).json({ message: 'OTP verified successfully. Please set your PIN.', userId: user._id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});



const bcrypt = require('bcryptjs');

router.post('/set-pin', async (req, res) => {
  const { userId, pin, confirmPin, password, fcmToken } = req.body;
  const { deviceid, model, manufacturer } = req.headers;

  if (!userId || !pin || !confirmPin || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (pin !== confirmPin) {
    return res.status(400).json({ message: 'PINs do not match' });
  }

  if (!/^\d{6}$/.test(pin)) {
    return res.status(400).json({ message: 'PIN must be 6 digits' });
  }

  if (password.length < 6) {
    return res.status(400).json({ message: 'Password must be at least 6 characters' });
  }

  try {
    const user = await User.findById(userId);

    if (!user || !user.isVerified) {
      return res.status(400).json({ message: 'User not verified or not found' });
    }

    const hashedPin = await bcrypt.hash(pin, 12);
    const hashedPassword = await bcrypt.hash(password, 12);

    user.pin = hashedPin;
    user.password = hashedPassword;

    if (fcmToken) {
      user.fcm_token = fcmToken;
      sendPushNotification(
        user.fcm_token,
        'Welcome!',
        'PIN & Password set successfully.'
      );
    }

    user.deviceInfo = {
      deviceId: deviceid,
      model: model,
      manufacturer: manufacturer,
    };

    await user.save();

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'PIN & Password set successfully',
      token,
    });

  } catch (err) {
    console.error('❌ set-pin error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});




router.post('/check-user', async (req, res) => {
  const { phone } = req.body;
  const { deviceid, model, manufacturer } = req.headers;

  if (!phone) {
    return res.status(400).json({ message: 'Phone number is required' });
  }

  try {
    const user = await User.findOne({ phone });

    if (!user) {
      return res.status(404).json({
        message: 'User not found. Please sign up first.',
      });
    }

    if (user.deviceInfo && user.deviceInfo.deviceId) {
      const {
        deviceId: savedDeviceId,
        model: savedModel,
        manufacturer: savedManufacturer,
      } = user.deviceInfo;

      if (
        savedDeviceId !== deviceid ||
        savedModel !== model ||
        savedManufacturer !== manufacturer
      ) {
        return res.status(403).json({
          message: `🚫 This account is already active on another device.\n\n📱 Company: ${savedManufacturer}\n🔖 Model: ${savedModel}\n\nPlease logout from that device first.`,
        });
      }
    }

    let authType = "none";

    if (user.pin && user.pin.trim() !== "") {
      authType = "pin";
    } else if (user.password && user.password.trim() !== "") {
      authType = "password";
    }

    return res.status(200).json({
      message: 'User found',
      userId: user._id,
      authType,
    });

  } catch (err) {
    console.error('❌ check-user error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});


//Get pin or password
router.get('/get-pin-pass', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({
      message: 'userId is required',
    });
  }

  try {
    const user = await User.findById(userId).select('pin password phone');

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    let authType = 'none';

    if (user.pin && user.pin.trim() !== '') {
      authType = 'pin';
    } else if (user.password && user.password.trim() !== '') {
      authType = 'password';
    }

    return res.status(200).json({
      authType,
      phone: user.phone,
    });

  } catch (err) {
    console.error('❌ get-auth-type error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});




router.post('/login', async (req, res) => {
  const { userId, pin, password, fcmToken } = req.body;
  const { deviceid, model, manufacturer, location, os } = req.headers;
  if (!userId || (!pin && !password)) {
    return res.status(400).json({
      message: 'UserId and PIN or Password are required',
    });
  }

  try {
    console.log("➡️ Login request for userId:", userId);
    console.log("➡️ Auth via:", pin ? "PIN" : "PASSWORD");

    const user = await User.findById(userId);

    if (!user) {
      return res.status(400).json({
        message: 'User not found',
      });
    }

    let isAuthenticated = false;

    // 🔐 PIN LOGIN
    if (pin) {
      if (!user.pin) {
        return res.status(400).json({
          message: 'PIN not set for this user',
        });
      }

      console.log("🔑 Comparing PIN hash");
      isAuthenticated = await bcrypt.compare(pin, user.pin);
    }

    // 🔐 PASSWORD LOGIN
    else if (password) {
      if (!user.password) {
        return res.status(400).json({
          message: 'Password not set for this user',
        });
      }

      console.log("🔑 Comparing PASSWORD hash");
      isAuthenticated = await bcrypt.compare(password, user.password);
    }

    if (!isAuthenticated) {
      return res.status(400).json({
        message: pin ? 'PIN is incorrect' : 'Password is incorrect',
      });
    }

    // 📱 Update device / FCM
    if (fcmToken) {
      user.fcm_token = fcmToken;
    }

    user.deviceInfo = {
      deviceId: deviceid,
      model,
      manufacturer,
      location: location,
      os: os
    };

    await user.save();
      // 🔥 Save login history
 

    const token = jwt.sign(
      { userId: user._id },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
      await trackLogin(user._id, req);

    console.log("✅ Login successful for:", user._id);

    res.status(200).json({
      message: 'Login successful',
      token,
    });

  } catch (err) {
    console.error('❌ Login crash:', err);
    res.status(500).json({ message: 'Server error' });
  }
});





// Logout API
router.post('/logout', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    if (user.fcm_token) {
      await sendPushNotification(
        user.fcm_token,
        'Logout',
        'You have been logged out successfully.'
      );
    }

    user.deviceInfo = null;

    await user.save();

    res.status(200).json({ message: 'Logout successful and device info cleared' });
  } catch (err) {
    console.error("❌ POST /logout error:", err);
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;
