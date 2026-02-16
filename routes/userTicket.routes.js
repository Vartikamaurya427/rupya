const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const TicketReply = require('../models/TicketReply');
const authMiddleware = require('../middleware/auth.middleware');

// User creates ticket
router.post('/create-ticket', authMiddleware, async (req, res) => {
  try {
    const { subject, message, priority } = req.body;

    if (!subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Subject and message required'
      });
    }

    const userId = req.user.userId; // 🔥 EXACT FIX

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload'
      });
    }

    const ticket = new Ticket({
      subject,
      submittedBy: userId,
      priority: priority || 'normal',
      lastReply: new Date()
    });

    await ticket.save();

    const reply = new TicketReply({
      ticketId: ticket._id,
      userId: userId,
      message
    });

    await reply.save();

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket
    });

  } catch (error) {
    console.error('Create Ticket Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});
module.exports = router;
