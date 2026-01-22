const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,

  phone: {
    type: String,
    unique: true,
    sparse: true, 
    trim: true
  },

  email: {
    type: String,
    unique: true,
    sparse: true, 
    trim: true
  },
  // isEmailVerified: { type: Boolean, default: false }, // NEW FIELD

  dob: String,

  reference: String,
  address: {
    street: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    zipCode: { type: String, default: "" },
    country: { type: String, default: "" },
  },

  aadhar: String,
  profileImage: String,

  otp: String,
  otpExpiresAt: Date,

  isVerified: { type: Boolean, default: false },

  pin: String,
  password: String,

  fcm_token: String,

  deviceInfo: {
    deviceId: String,
    model: String,
    manufacturer: String,
  },
// lastActiveAt: Date,
  wallet: {
    balance: { type: Number, default: 0 },
    transactions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' }]
  },

  savedPaymentMethods: [
    {
      method: {
        type: String,
        enum: ['UPI', 'BANK', 'CARD'],
        required: true
      },
      label: String,
      details: mongoose.Schema.Types.Mixed
    }
  ]

}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
