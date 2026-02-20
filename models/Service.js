const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      required: true,
      trim: true
    },
    serviceName: {
      type: String,
      required: true,
      trim: true
    },
    processingTime: {
      type: String,
      default: "",
      trim: true
    },
    icon: {
      type: String,
      default: "",
      trim: true
    },
    fixedCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    percentCharge: {
      type: Number,
      default: 0,
      min: 0
    },
    serviceInstruction: {
      type: String,
      default: ""
    },
    userData: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

serviceSchema.index({ category: 1, serviceName: 1 }, { unique: true });
serviceSchema.index({ serviceName: "text", category: "text" });

module.exports = mongoose.model("Service", serviceSchema);
