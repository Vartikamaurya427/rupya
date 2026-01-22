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
module.exports = router;