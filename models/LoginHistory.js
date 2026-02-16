// const mongoose = require('mongoose');

// const loginHistorySchema = new mongoose.Schema({
//   userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//   loginAt: { type: Date, default: Date.now },
//   ip: String,
//   location: String,
//   browser: String,
//   os: String,
//   deviceInfo: {
//     deviceId: String,
//     model: String,
//     manufacturer: String,
//   }
// });

// // Compound index for faster queries by user and recent logins
// loginHistorySchema.index({ userId: 1, loginAt: -1 });

// module.exports = mongoose.model('LoginHistory', loginHistorySchema);
const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  deviceId: String,
  deviceModel: String,
  deviceManufacturer: String,
  ipAddress: String,
  loginAt: { type: Date, default: Date.now },
  logoutAt: Date
});

module.exports = mongoose.model("LoginHistory", loginHistorySchema);
