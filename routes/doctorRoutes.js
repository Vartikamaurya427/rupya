const express = require("express");
const router = express.Router();
const doctorController = require("../controllers/doctorController");


// Routes
router.post("/send-otp", doctorController.sendOtpWithDetails);
router.post("/verify-otp", doctorController.verifyOtpWithDetails);

module.exports = router;
