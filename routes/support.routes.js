const express = require("express");
const authMiddleware = require("../middleware/auth.middleware");
const {
  startSupport,
  selectSupportOption,
} = require("../controllers/supportController");

const router = express.Router();

router.post("/start", authMiddleware, startSupport);
router.post("/select", authMiddleware, selectSupportOption);

module.exports = router;
