const express = require("express");
const axios = require("axios");
const crypto = require("crypto");
const router = express.Router();

// 🔑 Easebuzz Merchant Credentials (test)
const merchantKey = "WHOPMRWBH";
const merchantSalt = "9VBYUKAF1";

// 🧮 Hash generator (SHA512)
function generateHash(txnid, amount, productinfo, firstname, email) {
  const hashString = `${merchantKey}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${merchantSalt}`;
  const hash = crypto.createHash("sha512").update(hashString).digest("hex");
  return hash.toLowerCase();
}

// 🎯 Initiate Payment API (for Flutter app)
router.post("/initiate-payment", async (req, res) => {
  try {
    const { amount, firstname, email, phone } = req.body;
    const txnid = "TXN" + Date.now();
    const productinfo = "Easebuzz Test";
    const surl = "https://test.easebuzz.in/success";
    const furl = "https://test.easebuzz.in/failure";

    const hash = generateHash(txnid, amount, productinfo, firstname, email);

    const data = {
      key: merchantKey,
      txnid,
      amount,
      productinfo,
      firstname,
      email,
      phone,
      surl,
      furl,
      hash,
    };

    const response = await axios.post(
      "https://testpay.easebuzz.in/payment/initiateLink",
      new URLSearchParams(data)
    );

    // send Easebuzz response (contains access_key)
    res.json(response.data);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
