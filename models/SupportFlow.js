const mongoose = require("mongoose");

const supportFlowSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    parent_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "SupportFlow",
      default: null,
      index: true,
    },
    is_final: {
      type: Boolean,
      default: false,
    },
    issue_type: {
      type: String,
      trim: true,
      default: "",
    },
    is_active: {
      type: Boolean,
      default: true,
    },
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

supportFlowSchema.index({ parent_id: 1, is_active: 1, order: 1 });

module.exports = mongoose.model("SupportFlow", supportFlowSchema);
