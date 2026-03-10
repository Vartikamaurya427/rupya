const mongoose = require("mongoose");
const SupportFlow = require("../models/SupportFlow");
const SupportTicket = require("../models/SupportTicket");

const TICKET_PREFIX = "RUPYA";

const toOption = (flow) => ({
  flow_id: flow._id,
  title: flow.title,
  is_final: flow.is_final,
  order: flow.order,
});

const resolveFlowPath = async (selectedFlow) => {
  const path = [];
  const visited = new Set();
  let currentNode = selectedFlow;

  while (currentNode) {
    const currentId = String(currentNode._id);
    if (visited.has(currentId)) {
      throw new Error("Invalid support flow: cyclic parent reference detected");
    }

    visited.add(currentId);
    path.unshift(currentNode._id);

    if (!currentNode.parent_id) {
      break;
    }

    currentNode = await SupportFlow.findById(currentNode.parent_id)
      .select("_id parent_id")
      .lean();

    if (!currentNode) {
      throw new Error("Invalid support flow: parent node not found");
    }
  }

  return path;
};

const generateTicketNumber = async () => {
  const now = new Date();
  const datePart = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}${String(
    now.getUTCDate()
  ).padStart(2, "0")}`;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const randomPart = Math.floor(100000 + Math.random() * 900000);
    const candidate = `${TICKET_PREFIX}-${datePart}-${randomPart}`;
    const exists = await SupportTicket.exists({ ticket_number: candidate });
    if (!exists) return candidate;
  }

  return `${TICKET_PREFIX}-${datePart}-${Date.now()}`;
};

exports.startSupport = async (req, res) => {
  try {
    const rootFlows = await SupportFlow.find({
      parent_id: null,
      is_active: true,
    })
      .sort({ order: 1, _id: 1 })
      .select("_id title message is_final order")
      .lean();

    const welcomeMessage = rootFlows[0]?.message || "";

    return res.status(200).json({
      success: true,
      message: welcomeMessage,
      options: rootFlows.map(toOption),
    });
  } catch (error) {
    console.error("startSupport error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load support categories",
    });
  }
};

exports.selectSupportOption = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;
    const { flow_id: flowId, transaction_id: transactionId } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    if (!flowId || !mongoose.isValidObjectId(flowId)) {
      return res.status(400).json({
        success: false,
        message: "Valid flow_id is required",
      });
    }

    if (transactionId && !mongoose.isValidObjectId(transactionId)) {
      return res.status(400).json({
        success: false,
        message: "transaction_id must be a valid ObjectId",
      });
    }

    const selectedFlow = await SupportFlow.findOne({
      _id: flowId,
      is_active: true,
    }).lean();

    if (!selectedFlow) {
      return res.status(404).json({
        success: false,
        message: "Support option not found",
      });
    }

    if (!selectedFlow.is_final) {
      const childOptions = await SupportFlow.find({
        parent_id: selectedFlow._id,
        is_active: true,
      })
        .sort({ order: 1, _id: 1 })
        .select("_id title is_final order")
        .lean();

      return res.status(200).json({
        success: true,
        is_final: false,
        message: selectedFlow.message,
        options: childOptions.map(toOption),
      });
    }

    if (transactionId) {
      const existingOpenTicket = await SupportTicket.findOne({
        user_id: userId,
        transaction_id: transactionId,
        status: "OPEN",
      })
        .select("ticket_number status issue_type createdAt")
        .lean();

      if (existingOpenTicket) {
        return res.status(200).json({
          success: true,
          is_final: true,
          duplicate: true,
          message: "An open ticket already exists for this transaction",
          ticket: existingOpenTicket,
        });
      }
    }

    const flowPath = await resolveFlowPath(selectedFlow);
    const ticketNumber = await generateTicketNumber();

    let ticket;
    try {
      ticket = await SupportTicket.create({
        ticket_number: ticketNumber,
        user_id: userId,
        transaction_id: transactionId || null,
        issue_type: selectedFlow.issue_type || selectedFlow.title,
        flow_path: flowPath,
        status: "OPEN",
      });
    } catch (createError) {
      if (createError?.code === 11000 && transactionId) {
        const existingOpenTicket = await SupportTicket.findOne({
          user_id: userId,
          transaction_id: transactionId,
          status: "OPEN",
        })
          .select("ticket_number status issue_type createdAt")
          .lean();

        if (existingOpenTicket) {
          return res.status(200).json({
            success: true,
            is_final: true,
            duplicate: true,
            message: "An open ticket already exists for this transaction",
            ticket: existingOpenTicket,
          });
        }
      }

      throw createError;
    }

    return res.status(201).json({
      success: true,
      is_final: true,
      message: "Support ticket created successfully",
      ticket: {
        ticket_number: ticket.ticket_number,
        status: ticket.status,
        issue_type: ticket.issue_type,
        created_at: ticket.createdAt,
      },
    });
  } catch (error) {
    console.error("selectSupportOption error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process support selection",
    });
  }
};
