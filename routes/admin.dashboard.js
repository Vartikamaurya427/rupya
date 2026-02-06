const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const User = require("../models/User");
const Transaction = require("../models/Transaction");

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

    // Split name into firstName and lastName
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
      downline: user.downlineCount || 0
    };

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

    // ✅ Agar koi transaction nahi hai, dummy object add karo keys ke liye
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
router.get('/users/:id/deposits', async (req, res) => {
  try {
    const userId = req.params.id;

    // Sabhi deposits fetch karo
    const deposits = await Transaction.find({
      userId: userId,
      type: 'deposit'
    }).sort({ createdAt: -1 });

    // Status wise grouping and summation
    const statusSummary = {
      successful: { count: 0, amount: 0 },
      pending: { count: 0, amount: 0 },
      rejected: { count: 0, amount: 0 },
      initiated: { count: 0, amount: 0 }
    };

    deposits.forEach(deposit => {
      const status = deposit.status?.toLowerCase() || 'initiated'; // fallback initiated
      if (statusSummary[status]) {
        statusSummary[status].count += 1;
        statusSummary[status].amount += deposit.amount || 0;
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        statusSummary,
        deposits
      }
    });

  } catch (error) {
    console.error('❌ Deposit History Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
module.exports = router;