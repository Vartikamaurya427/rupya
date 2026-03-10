require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const SupportFlow = require("../models/SupportFlow");

const WELCOME_MESSAGE = "Hi, how can we help you today?";

const messageUpdates = [
  {
    title: "Payments & Transfers",
    message:
      "We understand you have a payment-related concern. Please select one of the options below to continue.",
  },
  {
    title: "Recharge & Bills",
    message:
      "We understand you have a recharge or bill concern. Please select one of the options below to continue.",
  },
  {
    title: "Wallet & Account",
    message:
      "We understand you have a wallet or account concern. Please select one of the options below to continue.",
  },
  {
    title: "Money deducted but transfer failed",
    message: "Please choose the transfer type below.",
  },
  {
    title: "Pending payment",
    message: "Please select the payment mode below.",
  },
  {
    title: "Recharge failed",
    message: "Please choose the recharge type below.",
  },
  {
    title: "Bill payment failed",
    message: "Please pick the bill category below.",
  },
  {
    title: "KYC / account verification",
    message: "Please pick the verification issue below.",
  },
];

const updateSupportMessages = async () => {
  try {
    await connectDB();

    const force = process.env.FORCE_UPDATE_SUPPORT_MESSAGE === "true";
    let totalMatched = 0;
    let totalModified = 0;

    for (const item of messageUpdates) {
      const filter = force
        ? { title: item.title }
        : {
            title: item.title,
            $or: [{ message: "" }, { message: WELCOME_MESSAGE }],
          };

      const result = await SupportFlow.updateMany(filter, {
        $set: { message: item.message },
      });

      totalMatched += result.matchedCount || 0;
      totalModified += result.modifiedCount || 0;
    }

    console.log(
      `SupportFlow messages updated. Matched: ${totalMatched}, Modified: ${totalModified}`
    );
  } catch (error) {
    console.error("Failed to update support messages:", error);
  } finally {
    await mongoose.disconnect();
  }
};

updateSupportMessages();
