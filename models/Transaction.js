const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['CREDIT', 'DEBIT'], required: true },
  amount: { type: Number, required: true },
  method: { type: String, enum: ['UPI', 'BANK', 'CARD', 'WALLET'], required: true },
  description: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Transaction', transactionSchema);
