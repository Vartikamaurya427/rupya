
const mongoose = require("mongoose");

const loginHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  deviceId: String,
  deviceModel: String,
  deviceManufacturer: String,
  os: String,
  location: String,
  ipAddress: String,
  loginAt: { type: Date, default: Date.now }
});
loginHistorySchema.index({ userId: 1, loginAt: -1 });

module.exports = mongoose.model("LoginHistory", loginHistorySchema);
