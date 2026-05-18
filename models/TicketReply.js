const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  senderType: {
    type: String,
    enum: ['user', 'admin'],
    required: true
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  senderName: { type: String, default: '' },
  message: { type: String, required: true },
  attachments: [String],
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('TicketReply', replySchema);
