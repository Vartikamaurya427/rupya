/**
 * BBPS Webhook Controller
 * Handles webhook callbacks from EKO for payment status updates
 */

const BbpsBillPayment = require('../models/BbpsBillPayment');
const BbpsBillFetch = require('../models/BbpsBillFetch');

/**
 * Handle EKO Webhook
 * POST /api/bbps/webhook/eko
 * 
 * EKO will send webhook callbacks for payment status updates
 * Expected payload structure:
 * {
 *   transactionId: "TXN123456789",
 *   paymentId: "PAY123456789",
 *   fetchReferenceId: "FR123456789",
 *   status: "SUCCESS" | "PENDING" | "FAILED",
 *   amount: 1500.00,
 *   message: "Payment processed successfully",
 *   timestamp: "2024-01-15T10:30:00Z"
 * }
 */
exports.handleEkoWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    // Log webhook received
    console.log('📥 EKO Webhook Received:', JSON.stringify(webhookData, null, 2));
    
    // Extract transaction details
    const {
      transactionId,
      paymentId,
      fetchReferenceId,
      status,
      amount,
      message,
      errorCode,
      errorMessage,
      timestamp
    } = webhookData;
    
    // Validate required fields
    if (!transactionId && !fetchReferenceId) {
      return res.status(400).json({
        success: false,
        message: 'Missing transactionId or fetchReferenceId'
      });
    }
    
    // Find payment by transactionId or fetchReferenceId
    let payment = null;
    
    if (transactionId) {
      payment = await BbpsBillPayment.findOne({ ekoTransactionId: transactionId });
    }
    
    if (!payment && fetchReferenceId) {
      payment = await BbpsBillPayment.findOne({ fetchReferenceId });
    }
    
    if (!payment) {
      console.warn('Payment not found for webhook:', { transactionId, fetchReferenceId });
      
      // Return 200 to prevent EKO from retrying
      return res.status(200).json({
        success: false,
        message: 'Payment not found, but webhook received'
      });
    }
    
    // Update payment status
    const previousStatus = payment.status;
    const newStatus = status?.toUpperCase() || payment.status;
    
    // Update payment record
    payment.status = newStatus;
    payment.webhookReceived = true;
    payment.webhookData = webhookData;
    payment.webhookReceivedAt = new Date();
    
    if (paymentId && !payment.ekoPaymentId) {
      payment.ekoPaymentId = paymentId;
    }
    
    // Update timestamps based on status
    if (newStatus === 'SUCCESS' && !payment.paidAt) {
      payment.paidAt = new Date(timestamp || Date.now());
    }
    
    if (newStatus === 'FAILED') {
      payment.errorCode = errorCode || payment.errorCode;
      payment.errorMessage = errorMessage || message || payment.errorMessage;
      payment.failureReason = errorMessage || message || payment.failureReason;
    }
    
    await payment.save();
    
    // Update bill fetch status if payment is successful
    if (newStatus === 'SUCCESS' && payment.billFetchId) {
      const billFetch = await BbpsBillFetch.findById(payment.billFetchId);
      if (billFetch && billFetch.status !== 'SUCCESS') {
        billFetch.status = 'SUCCESS';
        await billFetch.save();
      }
    }
    
    console.log(`Payment ${payment._id} updated: ${previousStatus} → ${newStatus}`);
    
    // Return success response to EKO
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      paymentId: payment._id,
      status: newStatus
    });
    
  } catch (error) {
    console.error('Error in webhook processing:', error);
    
    // Return 500 to allow EKO to retry
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed',
      error: error.message
    });
  }
};

/**
 * Webhook Health Check
 * GET /api/bbps/webhook/health
 */
exports.webhookHealthCheck = async (req, res) => {
  res.status(200).json({
    success: true,
    message: 'BBPS Webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
};

