const mongoose = require('mongoose');

/**
 * BBPS Operator Schema
 * Stores operator information fetched from EKO API
 */
const bbpsOperatorSchema = new mongoose.Schema({
  // EKO operator details
  operatorId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  operatorName: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    index: true
  },
  categoryName: {
    type: String
  },
  location: {
    type: String,
    index: true
  },
  locationName: {
    type: String
  },
  
  // Operator metadata
  logo: String,
  description: String,
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Parameters required for bill fetch
  parameters: [{
    name: String,
    label: String,
    type: String, // TEXT, NUMBER, DATE, DROPDOWN, etc.
    required: Boolean,
    options: [String], // For DROPDOWN type
    validation: {
      minLength: Number,
      maxLength: Number,
      pattern: String // Regex pattern
    }
  }],
  
  // Caching metadata
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Indexes for efficient queries
bbpsOperatorSchema.index({ category: 1, location: 1 });
bbpsOperatorSchema.index({ operatorName: 'text' }); // Text search

// Update updatedAt before saving
bbpsOperatorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('BbpsOperator', bbpsOperatorSchema);

