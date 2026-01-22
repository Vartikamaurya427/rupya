const mongoose = require('mongoose');

/**
 * BBPS Bill Fetch Schema
 * Stores bill fetch requests and responses from EKO API
 */
const bbpsBillFetchSchema = new mongoose.Schema({
  // User reference (if applicable)
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  
  // Operator details
  operatorId: {
    type: String,
    required: true,
    index: true
  },
  operatorName: String,
  
  // Bill fetch parameters (dynamic based on operator)
  parameters: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
    required: true
  },
  
  // EKO API response
  fetchReferenceId: {
    type: String,
    unique: true,
    sparse: true, // Allow null initially
    index: true
  },
  ekoTransactionId: String,
  
  // Bill details from EKO response
  billAmount: {
    type: Number
  },
  customerName: String,
  dueDate: Date,
  billDate: Date,
  billNumber: String,
  
  // Status tracking
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'EXPIRED'],
    default: 'PENDING',
    index: true
  },
  
  // EKO API response (full)
  ekoResponse: {
    type: mongoose.Schema.Types.Mixed
  },
  
  // Error details
  errorCode: String,
  errorMessage: String,
  
  // Idempotency
  idempotencyKey: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  // Timestamps
  fetchedAt: Date,
  expiresAt: Date, // Bill fetch reference expires after some time
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
bbpsBillFetchSchema.index({ userId: 1, createdAt: -1 });
bbpsBillFetchSchema.index({ operatorId: 1, status: 1 });
bbpsBillFetchSchema.index({ fetchReferenceId: 1 });
bbpsBillFetchSchema.index({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // Auto-delete after 30 days

// Update updatedAt before saving
bbpsBillFetchSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BbpsBillFetch', bbpsBillFetchSchema);

