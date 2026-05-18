const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const TicketReply = require('../models/TicketReply');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth.middleware');
const upload = require('../utils/upload');

const buildFileUrl = (req, filePath) => {
  if (!filePath) return null;
  const normalizedPath = String(filePath).replace(/\\/g, '/').replace(/^\/+/, '');
  return `${req.protocol}://${req.get('host')}/${normalizedPath}`;
};

const formatAttachmentList = (req, attachments = []) =>
  attachments.map((filePath) => ({
    path: filePath,
    url: buildFileUrl(req, filePath)
  }));

const formatTicketSummary = (req, ticket) => ({
  id: ticket._id,
  ticket_number: ticket.ticketNumber || `Ticket#${String(ticket._id).slice(-8)}`,
  subject: ticket.subject,
  description: ticket.description,
  status: ticket.status,
  priority: ticket.priority,
  last_reply: ticket.lastReply,
  last_reply_by: ticket.lastReplyBy,
  created_at: ticket.createdAt,
  updated_at: ticket.updatedAt,
  attachments: formatAttachmentList(req, ticket.attachments || [])
});

const formatReply = (req, reply) => ({
  id: reply._id,
  sender_type: reply.senderType || 'user',
  sender_name: reply.senderName || reply.userId?.name || 'User',
  message: reply.message,
  attachments: formatAttachmentList(req, reply.attachments || []),
  created_at: reply.createdAt,
  updated_at: reply.updatedAt,
  is_deleted: reply.isDeleted
});

const generateTicketNumber = async () => {
  const prefix = 'Ticket#';

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const randomPart = Math.floor(10000000 + Math.random() * 90000000);
    const candidate = `${prefix}${randomPart}`;
    const exists = await Ticket.exists({ ticketNumber: candidate });

    if (!exists) {
      return candidate;
    }
  }

  return `${prefix}${Date.now()}`;
};

// User creates ticket
router.post('/create-ticket', authMiddleware, upload.array('attachments', 5), async (req, res) => {
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

    const normalizedPriority = ['low', 'medium', 'high'].includes(String(priority).toLowerCase())
      ? String(priority).toLowerCase()
      : 'medium';
    const ticketNumber = await generateTicketNumber();
    const attachments = req.files ? req.files.map((file) => `uploads/${file.filename}`) : [];
    const user = await User.findById(userId).select('name');

    const ticket = new Ticket({
      ticketNumber,
      subject,
      description: message,
      submittedBy: userId,
      priority: normalizedPriority,
      attachments,
      status: 'pending',
      lastReply: new Date(),
      lastReplyBy: 'user'
    });

    await ticket.save();

    const reply = new TicketReply({
      ticketId: ticket._id,
      senderType: 'user',
      userId,
      senderName: user?.name || 'User',
      message,
      attachments
    });

    await reply.save();

    res.status(201).json({
      success: true,
      message: 'Ticket created successfully',
      ticket: formatTicketSummary(req, ticket),
      reply: formatReply(req, reply)
    });

  } catch (error) {
    console.error('Create Ticket Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

router.post('/:ticketId/reply', authMiddleware, upload.array('attachments', 5), async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({ success: false, message: 'Invalid token payload' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const ticket = await Ticket.findOne({ _id: ticketId, submittedBy: userId });
    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    if (ticket.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Closed ticket cannot be replied to' });
    }

    const attachments = req.files ? req.files.map((file) => `uploads/${file.filename}`) : [];
    const user = await User.findById(userId).select('name');
    const reply = await TicketReply.create({
      ticketId: ticket._id,
      senderType: 'user',
      userId,
      senderName: user?.name || 'User',
      message: message.trim(),
      attachments
    });

    ticket.status = 'pending';
    ticket.lastReply = new Date();
    ticket.lastReplyBy = 'user';
    await ticket.save();

    return res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      reply: formatReply(req, reply),
      ticket: formatTicketSummary(req, ticket)
    });
  } catch (error) {
    console.error('User Reply Ticket Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/my-tickets', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const { status, search = '', page = 1, limit = 10 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const query = { submittedBy: userId };

    if (status && ['pending', 'answered', 'closed'].includes(String(status).toLowerCase())) {
      query.status = String(status).toLowerCase();
    }

    if (search) {
      query.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } }
      ];
    }

    const [tickets, total] = await Promise.all([
      Ticket.find(query).sort({ updatedAt: -1, _id: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit),
      Ticket.countDocuments(query)
    ]);

    return res.status(200).json({
      success: true,
      page: safePage,
      per_page: safeLimit,
      total,
      last_page: Math.ceil(total / safeLimit) || 1,
      tickets: tickets.map((ticket) => formatTicketSummary(req, ticket))
    });
  } catch (error) {
    console.error('List User Tickets Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.get('/:ticketId', authMiddleware, async (req, res) => {
  try {
    const userId = req.user?.userId;
    const ticket = await Ticket.findOne({ _id: req.params.ticketId, submittedBy: userId }).populate(
      'submittedBy',
      'name email phone'
    );

    if (!ticket) {
      return res.status(404).json({ success: false, message: 'Ticket not found' });
    }

    const replies = await TicketReply.find({
      ticketId: ticket._id,
      isDeleted: false
    }).sort({ createdAt: 1, _id: 1 });

    return res.status(200).json({
      success: true,
      ticket: {
        ...formatTicketSummary(req, ticket),
        submitted_by: ticket.submittedBy
          ? {
              id: ticket.submittedBy._id,
              name: ticket.submittedBy.name || '',
              email: ticket.submittedBy.email || '',
              phone: ticket.submittedBy.phone || ''
            }
          : null
      },
      replies: replies.map((reply) => formatReply(req, reply))
    });
  } catch (error) {
    console.error('User Ticket Details Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
