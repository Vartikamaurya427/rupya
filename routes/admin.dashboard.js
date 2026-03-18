const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const LoginHistory = require("../models/LoginHistory"); // <-- ye add karo
const Service = require("../models/Service");
const Notification = require("../models/Notification");

const DEPOSIT_STATUSES = ["initiated", "pending", "successful", "rejected"];
const DEPOSIT_STATUS_SET = new Set(DEPOSIT_STATUSES);

const escapeRegex = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatTimeAgo = (value) => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  const safeDiffMs = Math.max(diffMs, 0);

  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  const month = 30 * day;
  const year = 365 * day;

  if (safeDiffMs < minute) {
    return "just now";
  }

  if (safeDiffMs < hour) {
    const minutes = Math.floor(safeDiffMs / minute);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  if (safeDiffMs < day) {
    const hours = Math.floor(safeDiffMs / hour);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  if (safeDiffMs < month) {
    const days = Math.floor(safeDiffMs / day);
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }

  if (safeDiffMs < year) {
    const months = Math.floor(safeDiffMs / month);
    return `${months} month${months === 1 ? "" : "s"} ago`;
  }

  const years = Math.floor(safeDiffMs / year);
  return `${years} year${years === 1 ? "" : "s"} ago`;
};

const serializeNotification = (notification) => ({
  ...notification,
  timeAgo: formatTimeAgo(notification.createdAt)
});

const buildUserDetails = (user) => {
  if (!user) {
    return null;
  }

  const nameParts = user.name ? user.name.split(" ") : ["", ""];

  return {
    firstName: nameParts[0] || "",
    lastName: nameParts.slice(1).join(" ") || "",
    email: user.email || "",
    mobileNumber: user.phone || "",
    address: user.address?.street || "",
    city: user.address?.city || "",
    state: user.address?.state || "",
    zipPostal: user.address?.zipCode || "",
    country: user.address?.country || "",
    emailVerified: user.emailVerified || false,
    mobileVerified: user.mobileVerified || false,
    twoFAVerified: user.twoFAVerified || false,
    balance: user.wallet?.balance || 0,
    deposits: user.deposits || 0,
    transactions: user.wallet?.transactions?.length || 0,
    servicePurchase: user.servicePurchase || 0,
    upline: user.upline || "N/A",
    downline: user.downlineCount || 0
  };
};

const buildDateRangeFilter = (startDateInput, endDateInput) => {
  if (!startDateInput && !endDateInput) {
    return null;
  }

  const range = {};

  if (startDateInput) {
    const start = new Date(startDateInput);
    if (!Number.isNaN(start.getTime())) {
      range.$gte = start;
    }
  }

  if (endDateInput) {
    const end = new Date(endDateInput);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }

  return Object.keys(range).length ? range : null;
};

const buildDepositBaseMatch = async (queryParams = {}) => {
  const match = { type: "deposit" };

  const status = String(queryParams.status || "").toLowerCase().trim();
  if (status && DEPOSIT_STATUS_SET.has(status)) {
    match.status = status;
  }

  const startDateInput = queryParams.start_date || queryParams.startDate;
  const endDateInput = queryParams.end_date || queryParams.endDate;
  const createdAtRange = buildDateRangeFilter(startDateInput, endDateInput);
  if (createdAtRange) {
    match.createdAt = createdAtRange;
  }

  const gateway = String(queryParams.gateway || "").trim();
  if (gateway) {
    match.gateway = { $regex: escapeRegex(gateway), $options: "i" };
  }

  const search = String(queryParams.search || "").trim();
  if (!search) {
    return match;
  }

  const searchRegex = new RegExp(escapeRegex(search), "i");
  const matchedUsers = await User.find({
    $or: [
      { name: searchRegex },
      { email: searchRegex },
      { phone: searchRegex }
    ]
  })
    .select("_id")
    .limit(250)
    .lean();

  const matchedUserIds = matchedUsers.map((user) => user._id);

  match.$or = [
    { trx: searchRegex },
    { gateway: searchRegex },
    { remark: searchRegex }
  ];

  if (matchedUserIds.length) {
    match.$or.push({ userId: { $in: matchedUserIds } });
  }

  return match;
};

router.get("/dashboard-master", adminAuth, async (req, res) => {
  try {
    // Use Promise.all for parallel queries
    const [
      totalUsers,
      activeUsers,
      emailUnverifiedUsers,
      mobileUnverifiedUsers
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ deviceInfo: { $ne: null } }), // active users
      User.countDocuments({
        $or: [
          { email: { $exists: false } },
          { email: "" }
        ]
      }),
      User.countDocuments({
        $or: [
          { phone: { $exists: false } },
          { phone: "" },
          { isVerified: false }
        ]
      })
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        emailUnverifiedUsers,
        mobileUnverifiedUsers
      }
    });

  } catch (error) {
    console.error("❌ Master Dashboard Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.get("/users", adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const query = {
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ]
    };

    const users = await User.find(query)
      .select(`
        name
        email
        phone
        address.country
        wallet.balance
        createdAt
      `)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Admin Users Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/users/active", adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const query = {
      deviceInfo: { $ne: null },
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ]
    };

    const users = await User.find(query)
      .select(`
        name
        email
        phone
        address.country
        wallet.balance
        createdAt
      `)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("❌ Active Users Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});
router.get("/users/email-unverified", adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const query = {
      emailVerified: false,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { phone: { $regex: search, $options: "i" } }
      ]
    };

    const users = await User.find(query)
      .select(`
        name
        email
        phone
        address.country
        wallet.balance
        createdAt
      `)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("❌ Email Unverified Users Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
router.get("/mobile-unverified-users", adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";

    const query = {
      $and: [
        {
          $or: [
            { mobileVerified: false },
            { mobileVerified: { $exists: false } }
          ]
        },
        {
          $or: [
            { name: { $regex: search, $options: "i" } },
            { email: { $regex: search, $options: "i" } },
            { phone: { $regex: search, $options: "i" } }
          ]
        }
      ]
    };

    const users = await User.find(query)
      .select("name email phone address.country wallet.balance createdAt")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await User.countDocuments(query);

    // 🔥 UI-friendly format
    const formattedUsers = users.map(user => ({
      id: user._id,
      user: user.name || "-",
      emailMobile: `${user.email || "-"} / ${user.phone || "-"}`,
      country: user.address?.country || "-",
      joinedAt: user.createdAt,
      balance: user.wallet?.balance || 0
    }));

    return res.status(200).json({
      success: true,
      data: formattedUsers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("❌ Mobile Unverified Users Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
router.get("/users/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("wallet.transactions")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }
    const userDetails = buildUserDetails(user);

    return res.status(200).json({
      success: true,
      data: userDetails
    });

  } catch (error) {
    console.error("❌ User Details Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
router.put("/users/:id", adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Jo fields update karna chahte ho wo allowed fields me define karlo
    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "address.street",
      "address.city",
      "address.state",
      "address.zipCode",
      "address.country",
      "emailVerified",
      "mobileVerified",
      "twoFAVerified"
    ];

    // Update object build karna req.body se (sirf allowed fields hi)
    const updates = {};
    allowedUpdates.forEach(field => {
      // Nested fields handle karna - example: address.city
      const keys = field.split(".");
      let value = req.body;
      for (const key of keys) {
        if (value && key in value) {
          value = value[key];
        } else {
          value = undefined;
          break;
        }
      }
      if (value !== undefined) {
        // Ab updates me nested set karna
        let current = updates;
        keys.forEach((key, i) => {
          if (i === keys.length - 1) {
            current[key] = value;
          } else {
            current[key] = current[key] || {};
            current = current[key];
          }
        });
      }
    });

    // Update user in DB
const user = await User.findByIdAndUpdate(
  userId,
  { $set: updates },
  { new: true, runValidators: true }
).lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error("❌ Update User Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});


router.get("/users/:id/transactions", adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const type = req.query.type;
    const remark = req.query.remark;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // 🔍 Filter build
    const query = { userId };

    if (type) query.type = type;
    if (remark) query.remark = { $regex: remark, $options: "i" };

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Transaction.countDocuments(query);

    // 🧠 UI-friendly format
    let formattedData = transactions.map(tx => ({
      trx: tx.trx,
      type: tx.type,
      remark: tx.remark,
      amount: tx.amount,
      postBalance: tx.postBalance,
      date: tx.createdAt
    }));

    // Agar koi transaction nahi hai, dummy object add karo keys ke liye
    if (formattedData.length === 0) {
      formattedData = [{
        trx: "",
        type: "",
        remark: "",
        amount: 0,
        postBalance: 0,
        date: ""
      }];
    }

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("Transaction History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.get("/transactions", adminAuth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    // Optional filters
    const type = req.query.type; // CREDIT / DEBIT etc.
    const remark = req.query.remark;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    // Build query
    const query = {};
    if (type) query.type = type;
    if (remark) query.remark = { $regex: remark, $options: "i" };
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Fetch transactions with pagination
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    if (!transactions.length) {
      return res.status(200).json({
        success: true,
        data: [],
        pagination: {
          total: 0,
          page,
          limit,
          totalPages: 0
        }
      });
    }

    // Fetch related users in batch
    const userIds = [...new Set(transactions.map(tx => tx.userId.toString()))];
    const users = await User.find({ _id: { $in: userIds } })
      .select("name email phone")
      .lean();

    const userMap = {};
    users.forEach(user => {
      userMap[user._id.toString()] = user;
    });

    // Format data for frontend table
    const formattedData = transactions.map(tx => {
      const user = userMap[tx.userId.toString()] || {};
      const transacted = tx.createdAt
        ? new Date(tx.createdAt).toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: true
          })
        : "";

      return {
        user: user.name || user.email || "@unknown",
        trx: tx.trx || tx._id.toString(),
        transacted: transacted,
        amount: (tx.amount != null) ? `$${tx.amount.toFixed(2)} USD` : "$0.00 USD",
        postBalance: (tx.postBalance != null) ? `$${tx.postBalance.toFixed(2)} USD` : "$0.00 USD",
        details: tx.remark || tx.description || ""
      };
    });

    const total = await Transaction.countDocuments(query);

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("All Transactions History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
router.get("/users/:id/deposits", adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);

    const query = {
      userId,
      type: "deposit"
    };

    const [deposits, total] = await Promise.all([
      Transaction.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(query)
    ]);

    const statusSummary = {
      initiated: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      successful: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };

    const grouped = await Transaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" }
        }
      }
    ]);

    grouped.forEach((item) => {
      const key = String(item._id || "").toLowerCase();
      if (statusSummary[key]) {
        statusSummary[key] = {
          count: item.count,
          amount: item.amount
        };
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: statusSummary,
        deposits
      },
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("User Deposit History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.get("/deposits", adminAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const match = await buildDepositBaseMatch(req.query);

    const [deposits, total] = await Promise.all([
      Transaction.find(match)
        .populate("userId", "name email phone")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(match)
    ]);

    const formatted = deposits.map((deposit) => ({
      id: deposit._id,
      transaction_id: deposit.trx || String(deposit._id),
      gateway: deposit.gateway || "-",
      initiated_at: deposit.createdAt,
      updated_at: deposit.updatedAt,
      user: {
        id: deposit.userId?._id || null,
        name: deposit.userId?.name || "-",
        username: deposit.userId?.email || deposit.userId?.phone || "-"
      },
      amount: deposit.amount || 0,
      charge: deposit.charge || 0,
      total_amount: (deposit.amount || 0) + (deposit.charge || 0),
      status: DEPOSIT_STATUS_SET.has(String(deposit.status || "").toLowerCase())
        ? String(deposit.status).toLowerCase()
        : "initiated"
    }));

    return res.status(200).json({
      success: true,
      total,
      page,
      limit,
      deposits: formatted
    });
  } catch (error) {
    console.error("Admin Deposit List Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.patch("/deposits/:id/status", adminAuth, async (req, res) => {
  try {
    const depositId = req.params.id;
    const nextStatus = String(req.body.status || "").toLowerCase().trim();

    if (!DEPOSIT_STATUS_SET.has(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `status must be one of: ${DEPOSIT_STATUSES.join(", ")}`
      });
    }

    const updatePayload = { status: nextStatus };
    if (Object.prototype.hasOwnProperty.call(req.body, "remark")) {
      updatePayload.remark = req.body.remark || "";
    }

    const updatedDeposit = await Transaction.findOneAndUpdate(
      { _id: depositId, type: "deposit" },
      {
        $set: updatePayload
      },
      { new: true }
    ).populate("userId", "name email phone");

    if (!updatedDeposit) {
      return res.status(404).json({
        success: false,
        message: "Deposit not found"
      });
    }
  await Notification.create({
  title: "Deposit status updated",
  message: `${updatedDeposit.userId?.phone || "User"} ka ₹${updatedDeposit.amount} deposit ${nextStatus} hua`,
  isRead: false,
  type: "recharge",
  refId: updatedDeposit._id,
  link: `/api/admin/dashboard/deposits/${updatedDeposit._id}/detail`,
});
 
    return res.status(200).json({
      success: true,
      message: "Deposit status updated",
      data: {
        id: updatedDeposit._id,
        transaction_id: updatedDeposit.trx,
        status: updatedDeposit.status,
        remark: updatedDeposit.remark || "",
        user: {
          id: updatedDeposit.userId?._id || null,
          name: updatedDeposit.userId?.name || "-",
          username: updatedDeposit.userId?.email || updatedDeposit.userId?.phone || "-"
        },
        amount: updatedDeposit.amount || 0,
        gateway: updatedDeposit.gateway || "-",
        initiated_at: updatedDeposit.createdAt,
        updated_at: updatedDeposit.updatedAt
      }
    });
  } catch (error) {
    console.error("Deposit Status Update Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.get("/deposits/summary", adminAuth, async (req, res) => {
  try {
    const match = await buildDepositBaseMatch(req.query);
    if (match.status) {
      delete match.status;
    }

    const grouped = await Transaction.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          amount: { $sum: "$amount" }
        }
      }
    ]);

    const summary = {
      initiated: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      successful: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 }
    };

    grouped.forEach((item) => {
      const status = String(item._id || "").toLowerCase();
      if (summary[status]) {
        summary[status] = {
          count: item.count,
          amount: item.amount
        };
      }
    });

    const total = Object.values(summary).reduce((acc, curr) => {
      return {
        count: acc.count + curr.count,
        amount: acc.amount + curr.amount
      };
    }, { count: 0, amount: 0 });

    return res.status(200).json({
      success: true,
      data: {
        summary,
        total
      }
    });
  } catch (error) {
    console.error("Deposit Summary Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
router.get("/login-history", adminAuth, async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: "Access denied: Admin only" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Fetch login history with user details
    const history = await LoginHistory.find({})
      .populate({
        path: "userId",
        select: "name email phone",
        model: "User"
      })
      .sort({ loginAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Remove records where user not found
    const filteredHistory = history.filter(item => item.userId);

    // Format response
    const formatted = filteredHistory.map(item => ({
      user: {
        name: item.userId.name || "-",
        username: item.userId.email || item.userId.phone || "-"
      },
      loginAt: item.loginAt,
      ip: item.ipAddress || "-",
      location: item.location || "-",
      device: `${item.deviceManufacturer || "-"} ${item.deviceModel || "-"}`,
      browserOS: `${item.browser || "-"} | ${item.os || "-"}`
    }));

    const total = await LoginHistory.countDocuments({});

    return res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error("❌ All Login History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

// -------- Single User Login History --------
router.get("/login-history/:userId", adminAuth, async (req, res) => {
  try {
    if (!req.admin) {
      return res.status(403).json({ message: "Access denied: Admin only" });
    }

    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const history = await LoginHistory.find({ userId })
      .sort({ loginAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("userId", "name username") // populate name & username
      .lean();

    const total = await LoginHistory.countDocuments({ userId });

    const formatted = history.map(item => ({
      user: {
        name: item.userId?.name || "-",
        username: item.userId?.username || "-",
      },
      loginAt: item.loginAt,
      ip: item.ipAddress || "-",
      location: item.location || "-",
      device: `${item.deviceManufacturer || "-"} ${item.deviceModel || "-"}`,
      browserOS: `${item.browser || "-"} | ${item.os || "-"}`
    }));

    return res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (err) {
    console.error("❌ Single User Login History Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
// router.get("/top-depositor", adminAuth, async (req, res) => {
//   try {
//     const result = await Transaction.aggregate([
//       {
//         $match: {
//           type: "deposit",
//           status: "successful"
//         }
//       },
//       {
//         $group: {
//           _id: "$userId",
//           totalDeposit: { $sum: "$amount" }
//         }
//       },
//       {
//         $sort: { totalDeposit: -1 }
//       },
//       {
//         $limit: 1
//       },
//       {
//         $lookup: {
//           from: "users", // make sure collection name correct ho
//           localField: "_id",
//           foreignField: "_id",
//           as: "user"
//         }
//       },
//       {
//         $unwind: "$user"
//       },
//       {
//         $project: {
//           _id: 0,
//           userId: "$user._id",
//           name: "$user.name",
//           email: "$user.email",
//           phone: "$user.phone",
//           totalDeposit: 1
//         }
//       }
//     ]);

//     if (!result.length) {
//       return res.status(200).json({
//         success: true,
//         data: {
//           name: "-",
//           totalDeposit: 0
//         }
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: result[0]
//     });

//   } catch (error) {
//     console.error("❌ Top Depositor Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error"
//     });
//   }
// });
// -------- Top Client (Highest Depositor) --------
// router.get("/top-client", adminAuth, async (req, res) => {
//   try {

//     const result = await Transaction.aggregate([
//       {
//         $match: {
//           type: "deposit",
//           status: { $in: ["successful", "approved"] } // sirf successful deposits
//         }
//       },
//       {
//         $group: {
//           _id: "$userId",
//           totalDeposit: { $sum: "$amount" }
//         }
//       },
//       {
//         $sort: { totalDeposit: -1 }
//       },
//       {
//         $limit: 1
//       }
//     ]);

//     if (!result.length) {
//       return res.status(200).json({
//         success: true,
//         data: null,
//         message: "No deposits found"
//       });
//     }

//     // User details fetch karo
//     const topUser = await User.findById(result[0]._id)
//       .select("name email phone")
//       .lean();

//     return res.status(200).json({
//       success: true,
//       data: {
//         user: {
//           id: topUser?._id,
//           name: topUser?.name || "-",
//           email: topUser?.email || "-",
//           phone: topUser?.phone || "-"
//         },
//         totalDeposit: result[0].totalDeposit
//       }
//     });

//   } catch (error) {
//     console.error("❌ Top Client Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error"
//     });
//   }
// });
// -------- Top Client (Full User Details Like /users/:id) --------
router.get("/top-client", adminAuth, async (req, res) => {
  try {

    // Step 1: Find top depositor
    const result = await Transaction.aggregate([
      {
        $match: {
          type: "deposit",
          status: { $in: ["successful", "approved"] }
        }
      },
      {
        $group: {
          _id: "$userId",
          totalDeposit: { $sum: "$amount" }
        }
      },
      { $sort: { totalDeposit: -1 } },
      { $limit: 1 }
    ]);

    if (!result.length) {
      return res.status(200).json({
        success: true,
        data: null
      });
    }

    const userId = result[0]._id;
    const totalDeposit = result[0].totalDeposit;

    // Step 2: Fetch full user like /users/:id
    const user = await User.findById(userId)
      .populate("wallet.transactions")
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const nameParts = user.name ? user.name.split(" ") : ["", ""];

    const userDetails = {
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" ") || "",
      email: user.email || "",
      mobileNumber: user.phone || "",
      address: user.address?.street || "",
      city: user.address?.city || "",
      state: user.address?.state || "",
      zipPostal: user.address?.zipCode || "",
      country: user.address?.country || "",
      emailVerified: user.emailVerified || false,
      mobileVerified: user.mobileVerified || false,
      twoFAVerified: user.twoFAVerified || false,
      balance: user.wallet?.balance || 0,
      deposits: user.deposits || 0,
      transactions: user.wallet?.transactions?.length || 0,
      servicePurchase: user.servicePurchase || 0,
      upline: user.upline || "N/A",
      downline: user.downlineCount || 0,

      // 🔥 Extra add
      totalDeposit: totalDeposit,
      userId: user._id
    };

    return res.status(200).json({
      success: true,
      data: userDetails
    });

  } catch (error) {
    console.error("❌ Top Client Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
router.put("/top-client/:id", adminAuth, async (req, res) => {
  try {
    const userId = req.params.id;

    // Allowed fields to update
    const allowedUpdates = [
      "name",
      "email",
      "phone",
      "address.street",
      "address.city",
      "address.state",
      "address.zipCode",
      "address.country",
      "emailVerified",
      "mobileVerified",
      "twoFAVerified"
    ];

    const updates = {};

    allowedUpdates.forEach(field => {
      const keys = field.split(".");
      let value = req.body;

      for (const key of keys) {
        if (value && typeof value === "object" && key in value) {
          value = value[key];
        } else {
          value = undefined;
          break;
        }
      }

      if (value !== undefined) {
        // Nested object set karna
        let current = updates;
        keys.forEach((key, i) => {
          if (i === keys.length - 1) {
            current[key] = value;
          } else {
            current[key] = current[key] || {};
            current = current[key];
          }
        });
      }
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: "No valid fields to update" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    return res.status(200).json({ success: true, data: user });

  } catch (error) {
    console.error("❌ Top Client Update Error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// -------- Manage Services (Admin Dashboard) --------
router.post("/services", adminAuth, async (req, res) => {
  try {
    const {
      category,
      serviceName,
      processingTime,
      icon,
      fixedCharge,
      percentCharge,
      serviceInstruction,
      userData,
      isActive
    } = req.body;

    if (!category || !serviceName) {
      return res.status(400).json({
        success: false,
        message: "category and serviceName are required"
      });
    }

    const service = await Service.create({
      category: String(category).trim(),
      serviceName: String(serviceName).trim(),
      processingTime: processingTime ? String(processingTime).trim() : "",
      icon: icon ? String(icon).trim() : "",
      fixedCharge: Number(fixedCharge) >= 0 ? Number(fixedCharge) : 0,
      percentCharge: Number(percentCharge) >= 0 ? Number(percentCharge) : 0,
      serviceInstruction: serviceInstruction || "",
      userData: Array.isArray(userData) ? userData : [],
      isActive: typeof isActive === "boolean" ? isActive : true
    });

    return res.status(201).json({
      success: true,
      message: "Service created successfully",
      data: service
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Service already exists in this category"
      });
    }
    console.error("Create Service Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.get("/services", adminAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.max(parseInt(req.query.limit, 10) || 10, 1);
    const search = (req.query.search || "").trim();
    const category = (req.query.category || "").trim();
    const isActive = req.query.isActive;

    const query = {};

    if (search) {
      query.$or = [
        { serviceName: { $regex: search, $options: "i" } },
        { category: { $regex: search, $options: "i" } }
      ];
    }

    if (category) {
      query.category = category;
    }

    if (typeof isActive !== "undefined") {
      query.isActive = String(isActive) === "true";
    }

    const [services, total] = await Promise.all([
      Service.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Service.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      data: services,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("List Services Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.get("/services/:id", adminAuth, async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: service
    });
  } catch (error) {
    console.error("Get Service Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.put("/services/:id", adminAuth, async (req, res) => {
  try {
    const allowedUpdates = [
      "category",
      "serviceName",
      "processingTime",
      "icon",
      "fixedCharge",
      "percentCharge",
      "serviceInstruction",
      "userData",
      "isActive"
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    });

    if (Object.prototype.hasOwnProperty.call(updates, "category")) {
      updates.category = String(updates.category || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "serviceName")) {
      updates.serviceName = String(updates.serviceName || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "processingTime")) {
      updates.processingTime = String(updates.processingTime || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "icon")) {
      updates.icon = String(updates.icon || "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(updates, "fixedCharge")) {
      updates.fixedCharge = Number(updates.fixedCharge);
      if (Number.isNaN(updates.fixedCharge) || updates.fixedCharge < 0) {
        return res.status(400).json({
          success: false,
          message: "fixedCharge must be a non-negative number"
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(updates, "percentCharge")) {
      updates.percentCharge = Number(updates.percentCharge);
      if (Number.isNaN(updates.percentCharge) || updates.percentCharge < 0) {
        return res.status(400).json({
          success: false,
          message: "percentCharge must be a non-negative number"
        });
      }
    }
    if (Object.prototype.hasOwnProperty.call(updates, "userData")) {
      updates.userData = Array.isArray(updates.userData) ? updates.userData : [];
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields to update"
      });
    }

    const service = await Service.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).lean();

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service updated successfully",
      data: service
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Service already exists in this category"
      });
    }
    console.error("Update Service Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.delete("/services/:id", adminAuth, async (req, res) => {
  try {
    const deletedService = await Service.findByIdAndDelete(req.params.id).lean();

    if (!deletedService) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Service deleted successfully"
    });
  } catch (error) {
    console.error("Delete Service Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});
router.get("/notifications", adminAuth, async (req, res) => {
  try {
    const notifications = await Notification.find().sort({ createdAt: -1 }).limit(50).lean();
    const unreadCount = await Notification.countDocuments({ isRead: false });

    return res.status(200).json({
      success: true,
      unreadCount,
      data: notifications.map(serializeNotification)
    });
  } catch (error) {
    console.error("Fetch Notifications Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
});

router.patch("/notifications/read", adminAuth, async (req, res) => {
  try {
    await Notification.updateMany({ isRead: false }, { $set: { isRead: true } });
    return res.status(200).json({ success: true, message: "Notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
router.patch("/notifications/:id/read", adminAuth, async (req, res) => {
  try {
    const notification = await Notification.findByIdAndUpdate(
      req.params.id,
      { $set: { isRead: true } },
      { new: true }
    ).lean();

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }

    let target = null;

    if (notification.type === "new_user" && notification.refId) {
      const user = await User.findById(notification.refId)
        .populate("wallet.transactions")
        .lean();
      target = buildUserDetails(user);
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        refId: notification.refId || null,
        isRead: notification.isRead,
        createdAt: notification.createdAt,
        timeAgo: formatTimeAgo(notification.createdAt),
        target
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
});
module.exports = router;
