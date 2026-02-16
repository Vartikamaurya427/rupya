const mongoose = require('mongoose');

const replySchema = new mongoose.Schema({
  ticketId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ticket', required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  message: { type: String, required: true },
  attachments: [String] // Array of file paths or URLs
}, { timestamps: true });

module.exports = mongoose.model('TicketReply', replySchema);
