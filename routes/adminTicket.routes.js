const express = require('express');
const router = express.Router();
const Ticket = require('../models/Ticket');
const User = require('../models/User');
const Admin = require('../models/Admin');
const adminAuth = require('../middleware/adminAuth');
const TicketReply = require('../models/TicketReply');
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

const formatTicketListItem = (req, ticket) => ({
  id: ticket._id,
  ticket_number: ticket.ticketNumber || `Ticket#${String(ticket._id).slice(-8)}`,
  subject: ticket.subject,
  submitted_by: ticket.submittedBy
    ? {
        id: ticket.submittedBy._id,
        name: ticket.submittedBy.name || '',
        email: ticket.submittedBy.email || '',
        phone: ticket.submittedBy.phone || ''
      }
    : null,
  status: ticket.status,
  priority: ticket.priority,
  last_reply: ticket.lastReply,
  last_reply_by: ticket.lastReplyBy,
  created_at: ticket.createdAt,
  updated_at: ticket.updatedAt
});

const formatReply = (req, reply) => ({
  id: reply._id,
  sender_type: reply.senderType || (reply.adminId ? 'admin' : 'user'),
  sender_name: reply.senderName || reply.userId?.name || reply.adminId?.email || 'User',
  user_id: reply.userId?._id || reply.userId || null,
  admin_id: reply.adminId?._id || reply.adminId || null,
  message: reply.message,
  attachments: formatAttachmentList(req, reply.attachments || []),
  created_at: reply.createdAt,
  updated_at: reply.updatedAt,
  is_deleted: reply.isDeleted
});

const normalizeStatus = (status) => {
  if (!status) return null;
  const value = String(status).toLowerCase();
  return ['pending', 'answered', 'closed'].includes(value) ? value : null;
};

const normalizePriority = (priority) => {
  if (!priority) return null;
  const value = String(priority).toLowerCase();
  return ['low', 'medium', 'high'].includes(value) ? value : null;
};

const listTickets = async (req, res) => {
  try {
    const { search = '', status, priority, page = 1, limit = 10 } = req.query;
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 100);
    const query = {};
    const normalizedStatus = normalizeStatus(status);
    const normalizedPriority = normalizePriority(priority);

    if (normalizedStatus) {
      query.status = normalizedStatus;
    }

    if (normalizedPriority) {
      query.priority = normalizedPriority;
    }

    if (search) {
      const userIds = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } },
          { phone: { $regex: search, $options: 'i' } }
        ]
      }).distinct('_id');

      query.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { submittedBy: { $in: userIds } }
      ];
    }

    const [tickets, total, pendingCount, answeredCount, closedCount] = await Promise.all([
      Ticket.find(query)
        .populate('submittedBy', 'name email phone')
        .sort({ updatedAt: -1, _id: -1 })
        .skip((safePage - 1) * safeLimit)
        .limit(safeLimit),
      Ticket.countDocuments(query),
      Ticket.countDocuments({ status: 'pending' }),
      Ticket.countDocuments({ status: 'answered' }),
      Ticket.countDocuments({ status: 'closed' })
    ]);

    res.status(200).json({
      success: true,
      page: safePage,
      per_page: safeLimit,
      total,
      last_page: Math.ceil(total / safeLimit) || 1,
      counts: {
        all: pendingCount + answeredCount + closedCount,
        pending: pendingCount,
        answered: answeredCount,
        closed: closedCount
      },
      tickets: tickets.map((ticket) => formatTicketListItem(req, ticket))
    });
  } catch (error) {
    console.error('Tickets List Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

router.get('/', adminAuth, listTickets);
router.get('/tickets', adminAuth, listTickets);

const getTicketDetails = async (req, res) => {
  try {
    const { ticketId } = req.params;

    const ticket = await Ticket.findById(ticketId).populate('submittedBy', 'name email phone');
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    const replies = await TicketReply.find({
      ticketId,
      isDeleted: false
    })
      .populate('userId', 'name email phone')
      .populate('adminId', 'email')
      .sort({ createdAt: 1, _id: 1 });

    res.status(200).json({
      success: true,
      ticket: {
        id: ticket._id,
        ticket_number: ticket.ticketNumber || `Ticket#${String(ticket._id).slice(-8)}`,
        subject: ticket.subject,
        description: ticket.description,
        status: ticket.status,
        priority: ticket.priority,
        attachments: formatAttachmentList(req, ticket.attachments || []),
        submitted_by: ticket.submittedBy
          ? {
              id: ticket.submittedBy._id,
              name: ticket.submittedBy.name || '',
              email: ticket.submittedBy.email || '',
              phone: ticket.submittedBy.phone || ''
            }
          : null,
        last_reply: ticket.lastReply,
        last_reply_by: ticket.lastReplyBy,
        closed_at: ticket.closedAt,
        created_at: ticket.createdAt,
        updated_at: ticket.updatedAt
      },
      replies: replies.map((reply) => formatReply(req, reply))
    });
  } catch (error) {
    console.error('Ticket Details Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

router.get('/:ticketId', adminAuth, getTicketDetails);
router.get('/ticket/:ticketId', adminAuth, getTicketDetails);

const replyToTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const { message } = req.body;
    const adminId = req.admin?.adminId;

    if (!message || message.trim() === '') {
      return res.status(400).json({ success: false, message: 'Message is required' });
    }

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });
    if (ticket.status === 'closed') {
      return res.status(400).json({ success: false, message: 'Closed ticket cannot be replied to' });
    }

    const admin = adminId ? await Admin.findById(adminId).select('email') : null;
    const attachments = req.files ? req.files.map((file) => `uploads/${file.filename}`) : [];

    const reply = new TicketReply({
      ticketId,
      senderType: 'admin',
      adminId,
      senderName: admin?.email || 'Admin',
      message: message.trim(),
      attachments
    });
    await reply.save();

    ticket.status = 'answered';
    ticket.lastReply = new Date();
    ticket.lastReplyBy = 'admin';
    await ticket.save();

    res.status(201).json({
      success: true,
      message: 'Reply sent successfully',
      reply: formatReply(req, reply)
    });
  } catch (error) {
    console.error('Reply Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

router.post('/:ticketId/reply', adminAuth, upload.array('attachments', 5), replyToTicket);
router.post('/ticket/:ticketId/reply', adminAuth, upload.array('attachments', 5), replyToTicket);

const closeTicket = async (req, res) => {
  try {
    const { ticketId } = req.params;
    const adminId = req.admin?.adminId;

    const ticket = await Ticket.findById(ticketId);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found' });

    ticket.status = 'closed';
    ticket.closedAt = new Date();
    ticket.closedByAdmin = adminId || null;
    await ticket.save();

    res.status(200).json({ success: true, message: 'Ticket closed successfully' });
  } catch (error) {
    console.error('Close Ticket Error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

router.patch('/:ticketId/close', adminAuth, closeTicket);
router.post('/ticket/:ticketId/close', adminAuth, closeTicket);

router.delete('/:ticketId/replies/:replyId', adminAuth, async (req, res) => {
  try {
    const { ticketId, replyId } = req.params;

    const reply = await TicketReply.findOne({ _id: replyId, ticketId });
    if (!reply) {
      return res.status(404).json({ success: false, message: 'Reply not found' });
    }

    reply.isDeleted = true;
    reply.deletedAt = new Date();
    await reply.save();

    return res.status(200).json({
      success: true,
      message: 'Reply deleted successfully'
    });
  } catch (error) {
    console.error('Delete Ticket Reply Error:', error);
    return res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
