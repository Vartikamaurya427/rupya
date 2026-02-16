const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const adminAuth = require('../middleware/adminAuth');
const TicketReply = require('../models/TicketReply');
const multer = require('multer');
const upload = require('../utils/upload'); // path aapke folder structure ke hisaab se
// Get all tickets list (pagination optional)
router.get('/tickets', adminAuth, async (req, res) => {
  try {
    const tickets = await Ticket.find()
      .populate('submittedBy', 'name email')
      .sort({ createdAt: -1 }) // latest first
      .limit(50);

    res.status(200).json({ success: true, tickets });
  } catch (error) {
    console.error('Tickets List Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
router.get('/ticket/:ticketId', adminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId).populate('submittedBy', 'name email');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const replies = await TicketReply.find({ ticketId }).populate('userId', 'name').sort({ createdAt: 1 });

    res.status(200).json({ success: true, ticket, replies });
  } catch (error) {
    console.error('Ticket Details Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/ticket/:ticketId/reply', adminAuth, upload.array('attachments', 5), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const attachments = req.files ? req.files.map(file => file.path) : [];

    const reply = new TicketReply({
      ticketId,
      userId,
      message,
      attachments
    });
    await reply.save();

    ticket.lastReply = new Date();
    await ticket.save();

    res.status(201).json({ success: true, reply });
  } catch (error) {
    console.error('Reply Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});
router.post('/ticket/:ticketId/close', adminAuth, async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    ticket.status = 'closed';
    await ticket.save();

    res.status(200).json({ success: true, message: 'Ticket closed successfully' });
  } catch (error) {
    console.error('Close Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
