const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const auth = require('../middleware/auth.middleware');


router.get('/balance', auth, walletController.getBalance);
router.post('/add', auth, walletController.addMoney);
router.post('/deduct', auth, walletController.deductMoney);
router.get('/transactions', auth, walletController.getTransactions);
router.post('/save-method', auth, walletController.savePaymentMethod);
router.get('/methods', auth, walletController.getSavedPaymentMethods);

module.exports = router;
