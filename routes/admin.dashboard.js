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
    const user = await User.findByIdAndUpdate(userId, updates, { new: true }).lean();

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
    const type = req.query.type;
    const remark = req.query.remark;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;

    const query = {};

    if (type) {
      query.type = type;
    }

    if (remark) {
      query.remark = { $regex: remark, $options: "i" };
    }

    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // Pagination using skip - or you can use range-based (_id) pagination if needed
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const total = await Transaction.countDocuments(query);

    // Format data as needed by frontend
    const formattedData = transactions.map((tx) => ({
      userId: tx.userId,
      trx: tx.trx,
      type: tx.type,
      remark: tx.remark,
      amount: tx.amount,
      postBalance: tx.postBalance,
      date: tx.createdAt,
    }));

    return res.status(200).json({
      success: true,
      data: formattedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("All Transactions History Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});
module.exports = router;