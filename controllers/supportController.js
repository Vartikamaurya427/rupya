const mongoose = require("mongoose");
const SupportFlow = require("../models/SupportFlow");
const SupportTicket = require("../models/SupportTicket");

const TICKET_PREFIX = "RUPYA";
const WELCOME_MESSAGE = "Hi, how can we help you today?";

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

    const welcomeMessage = WELCOME_MESSAGE;

    return res.status(200).json({
      success: true,
      message: welcomeMessage,
      description: welcomeMessage,
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

      const rawMessage = selectedFlow.message || "";
      const message =
        selectedFlow.parent_id === null && rawMessage === WELCOME_MESSAGE
          ? ""
          : rawMessage;

      const messages = [];
      if (message) {
        messages.push(message);
      }
      messages.push("Please select one of the options below to continue.");

      return res.status(200).json({
        success: true,
        is_final: false,
        message,
        messages,
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

// exports.getUserSupportTickets = async (req, res) => {
//   try {
//     const userId = req.user?.userId || req.user?.id;

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized user",
//       });
//     }

//     const { status, page = 1, limit = 20 } = req.query;
//     const safePage = Math.max(parseInt(page, 10) || 1, 1);
//     const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

//     const query = { user_id: userId };
//     if (status) {
//       query.status = String(status).toUpperCase();
//     }

//     const [tickets, total] = await Promise.all([
//       SupportTicket.find(query)
//         .sort({ createdAt: -1, _id: -1 })
//         .skip((safePage - 1) * safeLimit)
//         .limit(safeLimit)
//         .select("ticket_number status issue_type transaction_id createdAt")
//         .lean(),
//       SupportTicket.countDocuments(query),
//     ]);

//     return res.status(200).json({
//       success: true,
//       page: safePage,
//       limit: safeLimit,
//       total,
//       tickets: tickets.map((ticket) => ({
//         ticket_number: ticket.ticket_number,
//         status: ticket.status,
//         issue_type: ticket.issue_type,
//         transaction_id: ticket.transaction_id || null,
//         created_at: ticket.createdAt,
//       })),
//     });
//   } catch (error) {
//     console.error("getUserSupportTickets error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to load support tickets",
//     });
//   }
// };
exports.getUserSupportTickets = async (req, res) => {
  try {
    const userId = req.user?.userId || req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized user",
      });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const query = { user_id: userId };
    if (status) {
      query.status = String(status).toUpperCase();
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .select("ticket_number status issue_type transaction_id createdAt")
        .lean(),
      SupportTicket.countDocuments(query),
    ]);

    const lastPage = Math.ceil(total / safeLimit);

    return res.status(200).json({
      success: true,
      page: safePage,
      per_page: safeLimit,       // changed from 'limit' for clarity
      total,
      last_page: lastPage,
      next_page: safePage < lastPage ? safePage + 1 : null,
      prev_page: safePage > 1 ? safePage - 1 : null,
      tickets: tickets.map((ticket) => ({
        ticket_number: ticket.ticket_number,
        status: ticket.status,
        issue_type: ticket.issue_type,
        transaction_id: ticket.transaction_id || null,
        created_at: ticket.createdAt,
      })),
    });
  } catch (error) {
    console.error("getUserSupportTickets error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to load support tickets",
    });
  }
};