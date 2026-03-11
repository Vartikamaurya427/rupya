const mongoose = require("mongoose");

const transferSchema = new mongoose.Schema(
  {
    sender_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    receiver_name: { type: String, default: "", trim: true },
    receiver_phone: { type: String, default: "", trim: true },
    receiver_upi: { type: String, default: "", trim: true },
    receiver_account: { type: String, default: "", trim: true },
    amount: { type: Number, required: true },
    status: {
      type: String,
      enum: ["initiated", "pending", "successful", "failed"],
      default: "initiated",
      index: true,
    },
    remark: { type: String, default: "", trim: true },
    transaction_ref: { type: String, required: true, unique: true, index: true },
  },
  { timestamps: true }
);

transferSchema.index({ sender_id: 1, createdAt: -1 });

module.exports = mongoose.model("Transfer", transferSchema);
