const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  subject: { type: String, required: true },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, default: 'open' }, // open or closed
  priority: { type: String, default: 'normal' }, // low, normal, high
  lastReply: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('Ticket', ticketSchema);
