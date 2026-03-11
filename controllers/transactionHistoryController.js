const Transfer = require("../models/Transfer");
const { v4: uuidv4 } = require("uuid");
const BbpsBillPayment = require("../models/BbpsBillPayment");

exports.createTransfer = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const amount = Number(req.body.amount);
    const remark = String(req.body.remark || "").trim();

    const receiverName = String(req.body.receiver_name || "").trim();
    const receiverPhone = String(req.body.receiver_phone || "").trim();
    const receiverUpi = String(req.body.receiver_upi || "").trim();
    const receiverAccount = String(req.body.receiver_account || "").trim();

    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user" });
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, message: "Valid amount is required" });
    }

    if (!receiverPhone && !receiverUpi && !receiverAccount) {
      return res.status(400).json({
        success: false,
        message: "Receiver phone/UPI/account is required",
      });
    }

    const transfer = await Transfer.create({
      sender_id: userId,
      receiver_name: receiverName,
      receiver_phone: receiverPhone,
      receiver_upi: receiverUpi,
      receiver_account: receiverAccount,
      amount,
      remark,
      status: "initiated",
      transaction_ref: uuidv4(),
    });

    return res.status(201).json({
      success: true,
      message: "Transfer recorded",
      data: {
        transfer_id: transfer._id,
        transaction_ref: transfer.transaction_ref,
        status: transfer.status,
        amount: transfer.amount,
        receiver_name: transfer.receiver_name,
        receiver_phone: transfer.receiver_phone,
        receiver_upi: transfer.receiver_upi,
        receiver_account: transfer.receiver_account,
        created_at: transfer.createdAt,
      },
    });
  } catch (error) {
    console.error("createTransfer error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getTransferHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user" });
    }

    const { status, page = 1, limit = 10 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);

    const query = { sender_id: userId };
    if (status) {
      query.status = String(status).toLowerCase();
    }

    const [transfers, total] = await Promise.all([
      Transfer.find(query)
        .sort({ createdAt: -1, _id: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit)
        .lean(),
      Transfer.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total,
      transfers: transfers.map((t) => ({
        transfer_id: t._id,
        transaction_ref: t.transaction_ref,
        status: t.status,
        amount: t.amount,
        receiver_name: t.receiver_name,
        receiver_phone: t.receiver_phone,
        receiver_upi: t.receiver_upi,
        receiver_account: t.receiver_account,
        remark: t.remark,
        created_at: t.createdAt,
      })),
    });
  } catch (error) {
    console.error("getTransferHistory error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

exports.getUnifiedHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: "Unauthorized user" });
    }

    const { page = 1, limit = 10 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const fetchLimit = safePage * safeLimit;

    const [transfers, bbpsPayments] = await Promise.all([
      Transfer.find({ sender_id: userId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(fetchLimit)
        .lean(),
      BbpsBillPayment.find({ userId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(fetchLimit)
        .lean(),
    ]);

    const normalizedTransfers = transfers.map((t) => {
      const displayName =
        t.receiver_name ||
        t.receiver_phone ||
        t.receiver_upi ||
        t.receiver_account ||
        "Transfer";

      return {
        category: "transfer",
        display_name: displayName,
        subtitle: t.remark || "Money transfer",
        direction: "sent",
        amount: t.amount,
        status: t.status,
        reference: t.transaction_ref,
        receiver_phone: t.receiver_phone || "",
        receiver_upi: t.receiver_upi || "",
        receiver_account: t.receiver_account || "",
        remark: t.remark || "",
        created_at: t.createdAt,
      };
    });

    const normalizedBbps = bbpsPayments.map((b) => ({
      category: "bbps",
      display_name: b.operatorName || "BBPS Payment",
      subtitle: b.billType === "PREPAID" ? "Recharge" : "Bill payment",
      direction: "debit",
      bill_type: b.billType,
      utility_acc_no: b.utilityAccNo || "",
      amount: b.amount,
      status: b.status,
      reference: b.ekoTransactionId || b.idempotencyKey || String(b._id),
      created_at: b.createdAt,
    }));

    const merged = [...normalizedTransfers, ...normalizedBbps].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    const start = (safePage - 1) * safeLimit;
    const end = start + safeLimit;
    const pageItems = merged.slice(start, end);

    return res.status(200).json({
      success: true,
      page: safePage,
      limit: safeLimit,
      total: merged.length,
      items: pageItems,
    });
  } catch (error) {
    console.error("getUnifiedHistory error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
