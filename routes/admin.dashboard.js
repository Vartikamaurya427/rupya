const express = require("express");
const router = express.Router();

const adminAuth = require("../middleware/adminAuth");
const User = require("../models/User");

// /**
//  * TOTAL USERS (ADMIN DASHBOARD)
//  */
// router.get("/total-users", adminAuth, async (req, res) => {
//   try {
//     const totalUsers = await User.countDocuments();

//     return res.status(200).json({
//       success: true,
//       totalUsers
//     });

//   } catch (error) {
//     console.error("Total Users Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error"
//     });
//   }
// });
// router.get("/active-users", adminAuth, async (req, res) => {
//   try {
//     const activeUsers = await User.countDocuments({
//       deviceInfo: { $ne: null }
//     });

//     return res.status(200).json({
//       success: true,
//       activeUsers
//     });

//   } catch (error) {
//     console.error("Active Users Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error"
//     });
//   }
// });

// router.get("/email-unverified-users", adminAuth, async (req, res) => {
//   try {
//     const emailUnverifiedUsers = await User.countDocuments({
//       $or: [
//         { email: { $exists: false } },
//         { email: "" }
//       ]
//     });

//     return res.status(200).json({
//       success: true,
//       emailUnverifiedUsers
//     });

//   } catch (error) {
//     console.error("Email Unverified Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error"
//     });
//   }
// });
// router.get("/mobile-unverified-users", adminAuth, async (req, res) => {
//   try {
//     const mobileUnverifiedUsers = await User.countDocuments({
//       $or: [
//         { phone: { $exists: false } },
//         { phone: "" },
//         { isVerified: false }
//       ]
//     });

//     return res.status(200).json({
//       success: true,
//       mobileUnverifiedUsers
//     });

//   } catch (error) {
//     console.error("❌ Mobile Unverified Error:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Server error"
//     });
//   }
// });
// module.exports = router;
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

router.get("/users/:id", adminAuth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("wallet.transactions");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    res.json({
      success: true,
      data: user
    });

  } catch (error) {
    console.error("❌ User Details Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;