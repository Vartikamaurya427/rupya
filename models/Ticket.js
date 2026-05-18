const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  ticketNumber: { type: String, unique: true, sparse: true, index: true },
  subject: { type: String, required: true },
  description: { type: String, default: '' },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['pending', 'answered', 'closed'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  attachments: [{ type: String }],
  lastReply: { type: Date },
  lastReplyBy: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  closedAt: { type: Date, default: null },
  closedByAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
