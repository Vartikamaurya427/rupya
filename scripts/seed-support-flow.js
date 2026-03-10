require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const SupportFlow = require("../models/SupportFlow");

const sampleFlow = [
  {
    title: "Payments & Transfers",
    message: "Hi, how can we help you today?",
    order: 1,
    children: [
      {
        title: "Money deducted but transfer failed",
        message: "Choose the transfer type",
        order: 1,
        children: [
          {
            title: "UPI transfer issue",
            message: "We will create a support ticket for your UPI issue.",
            is_final: true,
            issue_type: "UPI_TRANSFER_FAILED",
            order: 1,
          },
          {
            title: "Bank transfer issue",
            message: "We will create a support ticket for your bank transfer issue.",
            is_final: true,
            issue_type: "BANK_TRANSFER_FAILED",
            order: 2,
          },
        ],
      },
      {
        title: "Pending payment",
        message: "Please select the payment mode",
        order: 2,
        children: [
          {
            title: "UPI payment pending",
            message: "We will create a support ticket for pending UPI payment.",
            is_final: true,
            issue_type: "UPI_PAYMENT_PENDING",
            order: 1,
          },
          {
            title: "Wallet payment pending",
            message: "We will create a support ticket for pending wallet payment.",
            is_final: true,
            issue_type: "WALLET_PAYMENT_PENDING",
            order: 2,
          },
        ],
      },
    ],
  },
  {
    title: "Recharge & Bills",
    message: "Hi, how can we help you today?",
    order: 2,
    children: [
      {
        title: "Recharge failed",
        message: "Choose recharge type",
        order: 1,
        children: [
          {
            title: "Mobile recharge failed",
            message: "We will create a support ticket for mobile recharge failure.",
            is_final: true,
            issue_type: "MOBILE_RECHARGE_FAILED",
            order: 1,
          },
          {
            title: "DTH recharge failed",
            message: "We will create a support ticket for DTH recharge failure.",
            is_final: true,
            issue_type: "DTH_RECHARGE_FAILED",
            order: 2,
          },
        ],
      },
      {
        title: "Bill payment failed",
        message: "Please pick bill category",
        order: 2,
        children: [
          {
            title: "Electricity bill failed",
            message: "We will create a support ticket for electricity bill issue.",
            is_final: true,
            issue_type: "ELECTRICITY_BILL_FAILED",
            order: 1,
          },
          {
            title: "Gas bill failed",
            message: "We will create a support ticket for gas bill issue.",
            is_final: true,
            issue_type: "GAS_BILL_FAILED",
            order: 2,
          },
        ],
      },
    ],
  },
  {
    title: "Wallet & Account",
    message: "Hi, how can we help you today?",
    order: 3,
    children: [
      {
        title: "Wallet balance mismatch",
        message: "We will create a support ticket for wallet mismatch.",
        is_final: true,
        issue_type: "WALLET_BALANCE_MISMATCH",
        order: 1,
      },
      {
        title: "KYC / account verification",
        message: "Pick the verification issue",
        order: 2,
        children: [
          {
            title: "KYC pending",
            message: "We will create a support ticket for pending KYC.",
            is_final: true,
            issue_type: "KYC_PENDING",
            order: 1,
          },
          {
            title: "KYC rejected",
            message: "We will create a support ticket for rejected KYC.",
            is_final: true,
            issue_type: "KYC_REJECTED",
            order: 2,
          },
        ],
      },
    ],
  },
];

const createFlowNodes = async (nodes, parentId = null) => {
  for (const node of nodes) {
    const created = await SupportFlow.create({
      title: node.title,
      message: node.message || "",
      parent_id: parentId,
      is_final: Boolean(node.is_final),
      issue_type: node.issue_type || "",
      is_active: true,
      order: node.order || 0,
    });

    if (Array.isArray(node.children) && node.children.length > 0) {
      await createFlowNodes(node.children, created._id);
    }
  }
};

const seedSupportFlow = async () => {
  try {
    await connectDB();

    const reset = process.env.RESET_SUPPORT_FLOW === "true";

    if (reset) {
      await SupportFlow.deleteMany({});
    }

    const existing = await SupportFlow.countDocuments();
    if (existing > 0 && !reset) {
      console.log(
        "SupportFlow already has data. Set RESET_SUPPORT_FLOW=true to reseed."
      );
      return;
    }

    await createFlowNodes(sampleFlow, null);
    console.log("SupportFlow seeded successfully.");
  } catch (error) {
    console.error("Failed to seed support flow:", error);
  } finally {
    await mongoose.disconnect();
  }
};

seedSupportFlow();
