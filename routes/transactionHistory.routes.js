const express = require("express");
const auth = require("../middleware/auth.middleware");
const {
  createTransfer,
  getTransferHistory,
  getUnifiedHistory,
} = require("../controllers/transactionHistoryController");

const router = express.Router();

router.post("/send", auth, createTransfer);
router.get("/history", auth, getTransferHistory);
router.get("/history/all", auth, getUnifiedHistory);

module.exports = router;
