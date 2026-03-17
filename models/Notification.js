const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
    },
    message: {
        type: String,
        required: true,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    type: { type: String, default: 'general' },   // ✅ new_user / recharge / support
    refId: { type: mongoose.Schema.Types.ObjectId, default: null }, // ✅ userId ya depositId
    link: { type: String, default: null },
    createdAt: {
        type: Date,
        default: Date.now,
    },
});

module.exports = mongoose.model('Notification', notificationSchema);
