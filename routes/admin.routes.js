const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const Admin = require("../models/Admin");
const adminAuth = require("../middleware/adminAuth");

const router = express.Router();

/**
 * ADMIN LOGIN
 */
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  const admin = await Admin.findOne({ email });
  if (!admin) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const isMatch = await bcrypt.compare(password, admin.password);
  if (!isMatch) {
    return res.status(401).json({ message: "Invalid credentials" });
  }

  const token = jwt.sign(
    { adminId: admin._id },
    process.env.JWT_SECRET,
    { expiresIn: "1h" }
  );
  console.log(`🎉 Admin logged in successfully: ${email}`);

  res.status(200).json({
    message: "Login successful",
    token
  });
});
// router.get("/dashboard", adminAuth, (req, res) => {
//   res.json({
//     message: "Welcome to Admin Dashboard"
//   });
// });
router.get("/dashboard", adminAuth, async (req, res) => {
  const admin = await Admin.findById(req.admin.adminId);
  console.log(`Dashboard accessed by: ${admin.email}`);
  res.json({
    message: `Welcome to Admin Dashboard, ${admin.email}`
  });
});
module.exports = router;
