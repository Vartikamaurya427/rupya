const User = require('../models/User');
const Transaction = require('../models/Transaction');
const sendPushNotification = require('../utils/sendPushNotification');


exports.addMoney = async (req, res) => {
  try {
    const { amount, method, description } = req.body;
    const userId = req.user.id || req.user.userId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMethodSaved = user.savedPaymentMethods.some(pm => pm.method === method);
    if (!isMethodSaved) {
      return res.status(400).json({ message: `Selected method (${method}) not saved` });
    }

    user.wallet.balance += amount;

    const transaction = await Transaction.create({
      userId: user._id,
      type: 'CREDIT',
      amount,
      method,
      description,
    });

    user.wallet.transactions.push(transaction._id);
    await user.save();

    if (user.fcm_token) {
      sendPushNotification(
        user.fcm_token,
        '💰 Money Added',
        `₹${amount} added via ${method}. Description: ${description}`
      );
    }

    res.status(200).json({
      success: true,
      newBalance: user.wallet.balance,
      transactionId: transaction._id,
    });
  } catch (error) {
    console.error('Add Money Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};



exports.deductMoney = async (req, res) => {
  try {
    const { amount, method, description } = req.body;
    const userId = req.user.id || req.user.userId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isMethodSaved = user.savedPaymentMethods.some(pm => pm.method === method);
    if (!isMethodSaved) {
      return res.status(400).json({ message: `Selected method (${method}) not saved` });
    }

    if (user.wallet.balance < amount) {
      return res.status(400).json({ message: 'Insufficient wallet balance' });
    }

    user.wallet.balance -= amount;

    const transaction = await Transaction.create({
      userId: user._id,
      type: 'DEBIT',
      amount,
      method,
      description,
    });

    user.wallet.transactions.push(transaction._id);
    await user.save();

    
    if (user.fcm_token) {
      sendPushNotification(
        user.fcm_token,
        '💸 Payment Made',
        `₹${amount} debited via ${method}. Description: ${description}`
      );
    }

    res.status(200).json({
      success: true,
      newBalance: user.wallet.balance,
      transactionId: transaction._id,
    });
  } catch (error) {
    console.error('Deduct Money Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};


exports.getBalance = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId; 
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({ balance: user.wallet.balance });
  } catch (error) {
    console.error('Get Balance Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.getTransactions = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const transactions = await Transaction.find({ userId }).sort({ createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    console.error('Get Transactions Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }

};


exports.savePaymentMethod = async (req, res) => {
  try {
    const { method, label, details } = req.body;
    const userId = req.user.id || req.user.userId;

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.savedPaymentMethods.push({ method, label, details });
    await user.save();

    res.status(200).json({ success: true, message: 'Payment method saved' });
  } catch (error) {
    console.error('Save Method Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

exports.getSavedPaymentMethods = async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const user = await User.findById(userId);

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(200).json({
      success: true,
      paymentMethods: user.savedPaymentMethods,
    });
  } catch (error) {
    console.error('Get Payment Methods Error:', error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

