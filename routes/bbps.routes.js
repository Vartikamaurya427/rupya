const express = require('express');
const router = express.Router();
const bbpsController = require('../controllers/bbps.controller');
const bbpsWebhookController = require('../controllers/bbpsWebhook.controller');
const auth = require('../middleware/auth.middleware');

// ============================================================================
// OPERATOR APIs (Public - no auth required for browsing operators)
// =============================================    ===============================

/**
 * Get Operator Categories
 * GET /api/bbps/operators/categories
 */
router.get('/operators/categories', bbpsController.getOperatorCategories);

/**
 * Get Operator Locations
 * GET /api/bbps/operators/locations?category=ELECTRICITY
 */
router.get('/operators/locations', bbpsController.getOperatorLocations);

/**
 * Get Operator List
 * GET /api/bbps/operators?category=ELECTRICITY&location=DELHI
 */
router.get('/operators', bbpsController.getOperatorList);

/**
 * Get Mobile Postpaid Operators
 * GET /api/bbps/operators/mobile-postpaid
 * Returns only allowed Mobile Postpaid operators filtered by strict criteria
 * NOTE: This must be BEFORE /operators/:operatorId to avoid route conflict
 */
router.get('/operators/mobile-postpaid', bbpsController.getMobilePostpaidOperators);
router.get('/operators/mobile-prepaid', bbpsController.getMobilePrepaidOperators);
/**
 * Get Operator Parameters
 * GET /api/bbps/operators/:operatorId/parameters
 */
router.get('/operators/:operatorId/parameters', bbpsController.getOperatorParameters);

/**
 * Get Operator Details
 * GET /api/bbps/operators/:operatorId
 * NOTE: This must be AFTER specific routes like /operators/mobile-postpaid
 */
router.get('/operators/:operatorId', bbpsController.getOperator);

// ============================================================================
// BILL OPERATIONS (Auth required)
// ============================================================================

/**
 * Fetch Bill
 * POST /api/bbps/fetch
 * Body: { operatorId, parameters: {...}, idempotencyKey? }
 */
router.post('/fetch', auth, bbpsController.fetchBill);

/**
 * Pay Bill
 * POST /api/bbps/pay
 * Body: { fetchReferenceId, amount, paymentMethod?, idempotencyKey? }
 */
router.post('/pay', auth, bbpsController.payBill);

/**
 * Check Payment Status
 * GET /api/bbps/payments/:transactionId/status
 */
router.get('/payments/:transactionId/status', auth, bbpsController.checkPaymentStatus);

/**
 * Get Payment History
 * GET /api/bbps/payments?status=SUCCESS&page=1&limit=20
 */
router.get('/payments', auth, bbpsController.getPaymentHistory);

/**
 * Get Payment Details
 * GET /api/bbps/payments/:paymentId
 */
router.get('/payments/:paymentId', auth, bbpsController.getPaymentDetails);

/**
 * Get Bill Fetch History
 * GET /api/bbps/fetches?operatorId=OP001&status=SUCCESS&page=1&limit=20
 */
router.get('/fetches', auth, bbpsController.getBillFetchHistory);

// ============================================================================
// WEBHOOK (Public - EKO will call this)
// ============================================================================

/**
 * EKO BBPS Webhook
 * POST /api/bbps/webhook/eko
 * This endpoint receives callbacks from EKO for payment status updates
 */
router.post('/webhook/eko', bbpsWebhookController.handleEkoWebhook);

/**
 * Webhook Health Check
 * GET /api/bbps/webhook/health
 */
router.get('/webhook/health', bbpsWebhookController.webhookHealthCheck);

module.exports = router;