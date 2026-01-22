/**
 * BBPS Controller
 * Handles HTTP requests for BBPS operations
 */

const bbpsService = require('../services/bbps.service');
const BbpsOperator = require('../models/BbpsOperator');
const BbpsBillFetch = require('../models/BbpsBillFetch');
const BbpsBillPayment = require('../models/BbpsBillPayment');

// ============================================================================
// OPERATOR APIs
// ============================================================================

/**
 * Get Operator Categories
 * GET /api/bbps/operators/categories
 */
exports.getOperatorCategories = async (req, res) => {
  try {
    const result = await bbpsService.getOperatorCategories();
    res.status(200).json(result);
  } catch (error) {
    console.error('Get Operator Categories Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch operator categories'
    });
  }
};

/**
 * Get Operator Locations
 * GET /api/bbps/operators/locations?category=ELECTRICITY
 */
exports.getOperatorLocations = async (req, res) => {
  try {
    const { category } = req.query;
    const result = await bbpsService.getOperatorLocations(category);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get Operator Locations Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch operator locations'
    });
  }
};

/**
 * Get Operator List
 * GET /api/bbps/operators?category=ELECTRICITY&location=DELHI
 */
exports.getOperatorList = async (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      location: req.query.location
    };
    
    const result = await bbpsService.getOperatorList(filters);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get Operator List Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch operator list'
    });
  }
};

/**
 * Get Operator Parameters
 * GET /api/bbps/operators/:operatorId/parameters
 */
exports.getOperatorParameters = async (req, res) => {
  try {
    const { operatorId } = req.params;
    
    if (!operatorId) {
      return res.status(400).json({
        success: false,
        message: 'Operator ID is required'
      });
    }
    
    const result = await bbpsService.getOperatorParameters(operatorId);
    res.status(200).json(result);
  } catch (error) {
    console.error('Get Operator Parameters Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch operator parameters'
    });
  }
};

/**
 * Get Operator from Database
 * GET /api/bbps/operators/:operatorId
 */
exports.getOperator = async (req, res) => {
  try {
    const { operatorId } = req.params;
    
    const operator = await BbpsOperator.findOne({ operatorId });
    if (!operator) {
      return res.status(404).json({
        success: false,
        message: 'Operator not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: operator
    });
  } catch (error) {
    console.error('Get Operator Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch operator'
    });
  }
};

/**
 * Get Mobile Postpaid Operators
 * GET /api/bbps/operators/mobile-postpaid
 * Returns only allowed Mobile Postpaid operators filtered by:
 * - operator_category_name === "Mobile Postpaid"
 * - status === "1"
 * - operator_id in allowed list
 */
exports.getMobilePostpaidOperators = async (req, res) => {
  try {
    // Optional: pass any filters from query params (e.g., location)
    const filters = {
      category: req.query.category,
      location: req.query.location,
      operator_category_id: req.query.operator_category_id
    };
    
    const result = await bbpsService.getMobilePostpaidOperators(filters);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Get Mobile Postpaid Operators Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch Mobile Postpaid operators'
    });
  }
};
exports.getMobilePrepaidOperators = async (req, res) => {
  try {
    // Optional: pass any filters from query params (e.g., location)
    const filters = {
      category: req.query.category,
      location: req.query.location,
      operator_category_id: req.query.operator_category_id
    };

    const result = await bbpsService.getMobilePrepaidOperators(filters);

    res.status(200).json(result);
  } catch (error) {
    console.error('Get Mobile Prepaid Operators Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch Mobile Postpaid operators'
    });
  }
};

// ============================================================================
// BILL OPERATIONS
// ============================================================================

/**
 * Fetch Bill
 * POST /api/bbps/fetch
 * Body: { operatorId, parameters: {...}, idempotencyKey? }
 */
exports.fetchBill = async (req, res) => {
  try {
    const { operatorId, parameters, idempotencyKey } = req.body;
    const userId = req.user?.id || req.user?.userId || null;
    
    // Validation
    if (!operatorId) {
      return res.status(400).json({
        success: false,
        message: 'Operator ID is required'
      });
    }
    
    if (!parameters || typeof parameters !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Parameters object is required'
      });
    }
    
    const result = await bbpsService.fetchBill(operatorId, parameters, userId, idempotencyKey);
    
    res.status(200).json({
      success: true,
      message: result.message || 'Bill fetched successfully',
      data: {
        fetchReferenceId: result.data.fetchReferenceId,
        billAmount: result.data.billAmount,
        customerName: result.data.customerName,
        dueDate: result.data.dueDate,
        billDate: result.data.billDate,
        billNumber: result.data.billNumber,
        status: result.data.status,
        operatorId: result.data.operatorId,
        operatorName: result.data.operatorName
      }
    });
  } catch (error) {
    console.error('Fetch Bill Error:', error);
    
    // Handle specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch bill'
    });
  }
};

/**
 * Pay Bill
 * POST /api/bbps/pay
 * Body: { fetchReferenceId, amount, paymentMethod?, idempotencyKey? }
 */
exports.payBill = async (req, res) => {
  try {
    const { fetchReferenceId, amount, paymentMethod, idempotencyKey } = req.body;
    const userId = req.user?.id || req.user?.userId;
    
    // Validation
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    if (!fetchReferenceId) {
      return res.status(400).json({
        success: false,
        message: 'Fetch Reference ID is required'
      });
    }
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }
    
    const result = await bbpsService.payBill(fetchReferenceId, amount, userId, paymentMethod, idempotencyKey);
    
    res.status(200).json({
      success: true,
      message: result.message || 'Payment processed',
      data: {
        paymentId: result.data._id,
        ekoTransactionId: result.data.ekoTransactionId,
        ekoPaymentId: result.data.ekoPaymentId,
        status: result.data.status,
        amount: result.data.amount,
        fetchReferenceId: result.data.fetchReferenceId
      }
    });
  } catch (error) {
    console.error('Pay Bill Error:', error);
    
    // Handle specific error types
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }
    
    if (error.message.includes('already paid') || error.message.includes('Amount mismatch') || error.message.includes('expired')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to pay bill'
    });
  }
};

/**
 * Check Payment Status
 * GET /api/bbps/payments/:transactionId/status
 */
exports.checkPaymentStatus = async (req, res) => {
  try {
    const { transactionId } = req.params;
    
    if (!transactionId) {
      return res.status(400).json({
        success: false,
        message: 'Transaction ID is required'
      });
    }
    
    const result = await bbpsService.checkPaymentStatus(transactionId);
    
    res.status(200).json(result);
  } catch (error) {
    console.error('Check Payment Status Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to check payment status'
    });
  }
};

/**
 * Get Bill Fetch History
 * GET /api/bbps/fetches
 */
exports.getBillFetchHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { operatorId, status, limit = 20, page = 1 } = req.query;
    
    const query = {};
    if (userId) query.userId = userId;
    if (operatorId) query.operatorId = operatorId;
    if (status) query.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const fetches = await BbpsBillFetch.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select('-ekoResponse -__v');
    
    const total = await BbpsBillFetch.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: fetches,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get Bill Fetch History Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch bill history'
    });
  }
};

/**
 * Get Payment History
 * GET /api/bbps/payments
 */
exports.getPaymentHistory = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    const { status, limit = 20, page = 1 } = req.query;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User authentication required'
      });
    }
    
    const query = { userId };
    if (status) query.status = status;
    
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const payments = await BbpsBillPayment.find(query)
      .populate('billFetchId', 'operatorName customerName billNumber')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .select('-ekoResponse -webhookData -__v');
    
    const total = await BbpsBillPayment.countDocuments(query);
    
    res.status(200).json({
      success: true,
      data: payments,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get Payment History Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch payment history'
    });
  }
};

/**
 * Get Payment Details
 * GET /api/bbps/payments/:paymentId
 */
exports.getPaymentDetails = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    
    const payment = await BbpsBillPayment.findById(paymentId)
      .populate('billFetchId');
    
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }
    
    // Check if user owns this payment
    if (userId && payment.userId.toString() !== userId.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }
    
    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error('Get Payment Details Error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to fetch payment details'
    });
  }
};
