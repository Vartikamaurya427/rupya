const mongoose = require('mongoose');

/**
 * BBPS Bill Payment Schema
 * Stores bill payment transactions
 */
const bbpsBillPaymentSchema = new mongoose.Schema({
  // User reference
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // Link to bill fetch
  billFetchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'BbpsBillFetch',
    required: true,
    index: true
  },
  fetchReferenceId: {
    type: String,
    required: true,
    index: true
  },
  
  // Operator details
  operatorId: {
    type: String,
    required: true,
    index: true
  },
  operatorName: String,
  
  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  
  // EKO transaction details
  ekoTransactionId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  ekoPaymentId: String,
  
  // Payment status
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED'],
    default: 'PENDING',
    required: true,
    index: true
  },
  
  // Payment method (if applicable)
  paymentMethod: {
    type: String,
    enum: ['WALLET', 'UPI', 'NETBANKING', 'CARD', 'OTHER']
  },
  
  // EKO API response (full)
  ekoResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Error details
  errorCode: String,
  errorMessage: String,
  failureReason: String,
  
  // Webhook tracking
  webhookReceived: {
    type: Boolean,
    default: false
  },
  webhookData: {
    type: mongoose.Schema.Types.Mixed
  },
  webhookReceivedAt: Date,
  
  // Idempotency
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Timestamps
  paidAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes
bbpsBillPaymentSchema.index({ userId: 1, createdAt: -1 });
bbpsBillPaymentSchema.index({ status: 1, createdAt: -1 });
bbpsBillPaymentSchema.index({ ekoTransactionId: 1 });
bbpsBillPaymentSchema.index({ fetchReferenceId: 1 });
bbpsBillPaymentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // Auto-delete after 90 days

// Update updatedAt before saving
bbpsBillPaymentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BbpsBillPayment', bbpsBillPaymentSchema);

