const mongoose = require("mongoose");

const supportTicketSchema = new mongoose.Schema(
  {
    ticket_number: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    transaction_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Transaction",
      default: null,
    },
    issue_type: {
      type: String,
      required: true,
      trim: true,
    },
    flow_path: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SupportFlow",
        required: true,
      },
    ],
    status: {
      type: String,
      enum: ["OPEN", "IN_PROGRESS", "CLOSED"],
      default: "OPEN",
      index: true,
    },
  },
  { timestamps: true }
);

supportTicketSchema.index(
  { user_id: 1, transaction_id: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: "OPEN",
      transaction_id: { $exists: true, $type: "objectId" },
    },
  }
);

module.exports = mongoose.model("SupportTicket", supportTicketSchema);
