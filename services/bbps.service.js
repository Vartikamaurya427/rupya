/**
 * BBPS Service
 * Handles all EKO BBPS API interactions
 */

const axios = require('axios');
const EKO_CONFIG = require('../config/eko');
const { generateEkoAuthHeaders, validateEkoResponse } = require('../utils/ekoAuth');
const BbpsOperator = require('../models/BbpsOperator');
const BbpsBillFetch = require('../models/BbpsBillFetch');
const BbpsBillPayment = require('../models/BbpsBillPayment');
const crypto = require('crypto');

/**
 * Make authenticated request to EKO API
 * @private
 */
async function makeEkoRequest(method, endpoint, data = null, params = {}) {
  try {
    const url = EKO_CONFIG.buildUrl(endpoint, params);
    const headers = generateEkoAuthHeaders();
    
    // Debug logging
    console.log(`🔗 EKO API Request: ${method} ${url}`);
    if (data) {
      console.log(`📦 Request Body:`, JSON.stringify(data, null, 2));
    }
    
    const config = {
      method,
      url,
      headers,
      timeout: 30000 // 30 seconds timeout
    };
    
    if (data) {
      config.data = data;
    }
    
    const response = await axios(config);
    return validateEkoResponse(response);
  } catch (error) {
    // Enhanced error logging with proper error.response?.data handling
    if (error.response) {
      // EKO API returned error response
      const status = error.response.status;
      const errorData = error.response?.data || {};
      
      // Handle different response data types (string, object, etc.)
      let errorMessage = 'Unknown error';
      let errorCode = 'API_ERROR';
      
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (typeof errorData === 'object') {
        errorMessage = errorData.message || errorData.error || errorData.errorMessage || error.message || 'Unknown error';
        errorCode = errorData.errorCode || errorData.code || errorData.statusCode || 'API_ERROR';
      } else {
        errorMessage = error.message || 'Unknown error';
      }
      
      console.error(`EKO API Error [${status}]:`, {
        url: error.config?.url,
        method: error.config?.method,
        status,
        errorCode,
        errorMessage,
        responseData: errorData
      });
      
      throw new Error(`EKO API Error [${errorCode}]: ${errorMessage} (Status: ${status})`);
    } else if (error.request) {
      // Request made but no response
      console.error(`EKO API: No response received for ${error.config?.url}`);
      throw new Error('EKO API: No response received. Check network connectivity.');
    } else {
      // Error in request setup
      console.error(`EKO API Request Error:`, error.message);
      throw new Error(`EKO API Request Error: ${error.message}`);
    }
  }
}

/**
 * Generate idempotency key
 */
function generateIdempotencyKey(prefix = 'bbps') {
  return `${prefix}_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
}

// ============================================================================
// OPERATOR APIs
// ============================================================================

/**
 * Get Operator Categories
 * Fetches list of all operator categories (Electricity, Water, Gas, etc.)
 * 
 * Response structure (as per EKO docs):
 * {
 *   status: "success",
 *   data: [
 *     {
 *       operator_category_name: "Electricity",
 *       operator_category_id: 1,
 *       operator_category_group: "UTILITY",
 *       status: "1" // 1 = active, 0 = inactive
 *     },
 *     ...
 *   ]
 * }
 */
async function getOperatorCategories() {
  // Build URL from config (production/staging based on EKO_ENV)
  const url = EKO_CONFIG.buildUrl(EKO_CONFIG.ENDPOINTS.GET_OPERATOR_CATEGORIES);
  
  // CRITICAL: Log URL at function start to verify new code is running
  console.log("=".repeat(80));
  console.log("getOperatorCategories() - NEW CODE VERSION");
  console.log("URL:", url);
  console.log("=".repeat(80));
  
  try {
    // Generate authentication headers
    const headers = generateEkoAuthHeaders();
    
    // Log the URL being hit (VERY IMPORTANT FOR DEBUGGING)
    console.log("Hitting EKO URL:", url);
    console.log("Headers:", {
      'Content-Type': headers['Content-Type'],
      'developer_key': headers['developer_key'],
      'secret-key': headers['secret-key'] ? '***' : 'MISSING',
      'secret-key-timestamp': headers['secret-key-timestamp']
    });
    
    // Make GET request using axios directly
    const response = await axios.get(url, {
      headers: headers,
      timeout: 30000
    });
    
    // Validate response
    if (!response || !response.data) {
      console.warn('Unexpected response structure:', response);
      return {
        success: true,
        data: []
      };
    }
    
    // Handle EKO response structure
    const responseData = response.data;
    let categories = [];
    
    if (responseData.data && Array.isArray(responseData.data)) {
      categories = responseData.data;
    } else if (Array.isArray(responseData)) {
      categories = responseData;
    }
    
    // Filter only active categories (status = "1")
    const activeCategories = categories.filter(cat => cat.status === "1" || cat.status === 1);
    
    console.log(`Successfully fetched ${activeCategories.length} active operator categories`);
    
    return {
      success: true,
      data: activeCategories
    };
  } catch (error) {
    // Enhanced error logging with error.response?.data
    const errorDetails = {
      error: error.message,
      url: url
    };
    
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.responseData = error.response?.data || {};
      errorDetails.headers = error.response.headers;
    }
    
    console.error('Failed to fetch operator categories:', errorDetails);
    
    throw new Error(`Failed to fetch operator categories: ${error.message}`);
  }
}

/**
 * Get Operator Locations
 * Fetches list of locations/states where operators are available
 */
async function getOperatorLocations(category = null) {
  // Build URL from config (production/staging based on EKO_ENV)
  // Note: EKO v2 operators_location endpoint does NOT require category query param.
  // Reference: https://staging.eko.in/ekoapi/v2/billpayments/operators_location
  const url = EKO_CONFIG.buildUrl(EKO_CONFIG.ENDPOINTS.GET_OPERATOR_LOCATIONS);
  
  // CRITICAL: Log URL at function start to verify new code is running
  console.log("=".repeat(80));
  console.log("getOperatorLocations() - NEW CODE VERSION");
  console.log("URL:", url);
  console.log("=".repeat(80));
  
  try {
    // Generate authentication headers
    const headers = generateEkoAuthHeaders();
    
    // Log the URL being hit
    console.log("Hitting EKO URL:", url);
    console.log("Headers:", {
      'Content-Type': headers['Content-Type'],
      'developer_key': headers['developer_key'],
      'secret-key': headers['secret-key'] ? '***' : 'MISSING',
      'secret-key-timestamp': headers['secret-key-timestamp']
    });
    
    // Make GET request using axios directly
    const response = await axios.get(url, {
      headers: headers,
      timeout: 30000
    });
    
    // Validate response
    if (!response || !response.data) {
      console.warn('Unexpected response structure:', response);
      return {
        success: true,
        data: []
      };
    }
    
    // Handle EKO response structure
    // Response format: { "data": [{ "operator_location_name": "...", "operator_location_id": "...", "abbreviation": "..." }] }
    const responseData = response.data;
    let locations = [];
    
    if (responseData.data && Array.isArray(responseData.data)) {
      locations = responseData.data;
    } else if (Array.isArray(responseData)) {
      locations = responseData;
    }
    
    // Map to consistent format
    const mappedLocations = locations.map(loc => ({
      operator_location_name: loc.operator_location_name || loc.locationName,
      operator_location_id: loc.operator_location_id || loc.locationId,
      abbreviation: loc.abbreviation || loc.abbr
    }));
    
    console.log(`Successfully fetched ${mappedLocations.length} operator locations`);
    
    return {
      success: true,
      data: mappedLocations
    };
  } catch (error) {
    // Enhanced error logging with error.response?.data
    const errorDetails = {
      error: error.message,
      url: url
    };
    
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.responseData = error.response?.data || {};
      errorDetails.headers = error.response.headers;
    }
    
    console.error('Failed to fetch operator locations:', errorDetails);
    
    throw new Error(`Failed to fetch operator locations: ${error.message}`);
  }
}

/**
 * Get Operator List
 * Fetches list of operators based on operator_category_id
 * 
 * Query Parameters:
 * - operator_category_id: Filter by category ID (from Get Operator Categories API)
 */
async function getOperatorList(filters = {}) {
  // Build URL from config (production/staging based on EKO_ENV)
  let url = EKO_CONFIG.buildUrl(EKO_CONFIG.ENDPOINTS.GET_OPERATOR_LIST);
  
  // Build query parameters
  const { category, operator_category_id, location } = filters;
  const queryParams = [];
  
  // operator_category_id takes priority (as per EKO docs)
  if (operator_category_id) {
    queryParams.push(`operator_category_id=${encodeURIComponent(operator_category_id)}`);
  } else if (category) {
    queryParams.push(`operator_category_id=${encodeURIComponent(category)}`);
  }
  
  if (location) {
    queryParams.push(`location_id=${encodeURIComponent(location)}`);
  }
  
  if (queryParams.length > 0) {
    url += `?${queryParams.join('&')}`;
  }
  
  // CRITICAL: Log URL at function start to verify new code is running
  console.log("=".repeat(80));
  console.log("getOperatorList() - NEW CODE VERSION");
  console.log("URL:", url);
  console.log("=".repeat(80));
  
  try {
    // Generate authentication headers
    const headers = generateEkoAuthHeaders();
    
    // Log the URL being hit
    console.log("Hitting EKO URL:", url);
    
    // Make GET request using axios directly
    const response = await axios.get(url, {
      headers: headers,
      timeout: 30000
    });
    
    // Validate response
    if (!response || !response.data) {
      console.warn('Unexpected response structure:', response);
      return {
        success: true,
        data: []
      };
    }
    
    // Handle EKO response structure
    // Response format: { "data": [{ "operator_id": 1, "name": "...", "operator_category": 5, ... }] }
    const responseData = response.data;
    let operators = [];
    
    if (responseData.data && Array.isArray(responseData.data)) {
      operators = responseData.data;
    } else if (Array.isArray(responseData)) {
      operators = responseData;
    }
    
    // Sync operators to database
    if (operators.length > 0) {
      await syncOperatorsToDB(operators);
    }
    
    console.log(`Successfully fetched ${operators.length} operators`);
    
    return {
      success: true,
      data: operators
    };
  } catch (error) {
    // Enhanced error logging with error.response?.data
    const errorDetails = {
      error: error.message,
      url: url
    };
    
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.responseData = error.response?.data || {};
    }
    
    console.error('Failed to fetch operator list:', errorDetails);
    throw new Error(`Failed to fetch operator list: ${error.message}`);
  }
}

/**
 * Get Operator Parameters
 * Fetches required parameters for a specific operator to fetch bills
 */
async function getOperatorParameters(operatorId) {
  // Build URL from config (production/staging based on EKO_ENV)
  const url = EKO_CONFIG.buildUrl(EKO_CONFIG.ENDPOINTS.GET_OPERATOR_PARAMETERS, { operatorId });
  
  // CRITICAL: Log URL at function start to verify new code is running
  console.log("=".repeat(80));
  console.log("getOperatorParameters() - NEW CODE VERSION");
  console.log("URL:", url);
  console.log("=".repeat(80));
  
  try {
    // Generate authentication headers
    const headers = generateEkoAuthHeaders();
    
    // Log the URL being hit
    console.log("Hitting EKO URL:", url);
    
    // Make GET request using axios directly
    const response = await axios.get(url, {
      headers: headers,
      timeout: 30000
    });
    
    // Validate response
    if (!response || !response.data) {
      console.warn('Unexpected response structure:', response);
      return {
        success: true,
        data: {
          operatorId,
          parameters: []
        }
      };
    }
    
    // Handle EKO response structure
    const responseData = response.data;
    const parameters = responseData.data?.parameters || responseData.parameters || [];
    
    // Update operator in database with parameters
    await BbpsOperator.findOneAndUpdate(
      { operatorId },
      {
        parameters,
        lastSyncedAt: new Date()
      },
      { upsert: false }
    );
    
    console.log(`Successfully fetched parameters for operator ${operatorId}`);
    
    return {
      success: true,
      data: {
        operatorId,
        parameters
      }
    };
  } catch (error) {
    // Enhanced error logging with error.response?.data
    const errorDetails = {
      error: error.message,
      url: url,
      operatorId: operatorId
    };
    
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.responseData = error.response?.data || {};
    }
    
    console.error('Failed to fetch operator parameters:', errorDetails);
    throw new Error(`Failed to fetch operator parameters: ${error.message}`);
  }
}

/**
 * Sync operators to database
 * @private
 */
async function syncOperatorsToDB(operators) {
  try {
    const bulkOps = operators.map(operator => ({
      updateOne: {
        filter: { operatorId: operator.operator_id || operator.operatorId },
        update: {
          $set: {
            operatorId: operator.operator_id || operator.operatorId,
            operatorName: operator.operator_name || operator.operatorName || operator.name,
            category: operator.operator_category_id || operator.category || operator.categoryId,
            categoryName: operator.operator_category_name || operator.categoryName,
            location: operator.location || operator.locationId,
            locationName: operator.locationName,
            logo: operator.logo || operator.operator_logo,
            description: operator.description,
            isActive: operator.status === "1" || operator.status === 1 || operator.isActive !== false,
            lastSyncedAt: new Date()
          }
        },
        upsert: true
      }
    }));
    
    if (bulkOps.length > 0) {
      await BbpsOperator.bulkWrite(bulkOps);
    }
  } catch (error) {
    console.error('Error syncing operators to DB:', error);
    // Don't throw - this is a background sync operation
  }
}

// ============================================================================
// BILL OPERATIONS
// ============================================================================

/**
 * Fetch Bill
 * Fetches bill details from operator using dynamic parameters
 */
async function fetchBill(operatorId, parameters, userId = null, idempotencyKey = null) {
  try {
    // Generate idempotency key if not provided
    const idempotency = idempotencyKey || generateIdempotencyKey('fetch');
    
    // Check for duplicate request
    const existingFetch = await BbpsBillFetch.findOne({ idempotencyKey: idempotency });
    if (existingFetch) {
      return {
        success: true,
        data: existingFetch,
        message: 'Duplicate request - returning existing fetch'
      };
    }
    
    // Get operator details
    const operator = await BbpsOperator.findOne({ operatorId });
    if (!operator) {
      throw new Error(`Operator ${operatorId} not found. Please sync operators first.`);
    }
    
    // Build URL from config (production/staging based on EKO_ENV)
    const url = EKO_CONFIG.buildUrl(EKO_CONFIG.ENDPOINTS.FETCH_BILL);
    
    // Prepare request payload
    const payload = {
      initiator_id: EKO_CONFIG.INITIATOR_ID,
      operator_id: operatorId,
      ...parameters // Dynamic parameters based on operator requirements (e.g., consumer_number, mobile, etc.)
    };
    
    // Generate authentication headers
    const headers = generateEkoAuthHeaders();
    
    // Log the request
    console.log("=".repeat(80));
    console.log("fetchBill() - NEW CODE VERSION");
    console.log("URL:", url);
    console.log("Payload:", JSON.stringify(payload, null, 2));
    console.log("=".repeat(80));
    
    // Make POST request using axios directly
    const response = await axios.post(url, payload, {
      headers: headers,
      timeout: 30000
    });
    
    // Handle EKO response structure
    // Response might be: { "data": { ... } } or direct object
    const responseData = response.data?.data || response.data || response;
    
    console.log("Fetch Bill Response:", JSON.stringify(responseData, null, 2));
    
    // Save to database
    const billFetch = new BbpsBillFetch({
      userId,
      operatorId,
      operatorName: operator.operatorName,
      parameters,
      fetchReferenceId: responseData.fetchReferenceId,
      ekoTransactionId: responseData.transactionId,
      billAmount: responseData.billAmount,
      customerName: responseData.customerName,
      dueDate: responseData.dueDate ? new Date(responseData.dueDate) : null,
      billDate: responseData.billDate ? new Date(responseData.billDate) : null,
      billNumber: responseData.billNumber,
      status: responseData.status === 'SUCCESS' ? 'SUCCESS' : 'PENDING',
      ekoResponse: responseData,
      idempotencyKey: idempotency,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // Expires in 24 hours
    });
    
    await billFetch.save();
    
    return {
      success: true,
      data: billFetch,
      message: 'Bill fetched successfully'
    };
  } catch (error) {
    // Enhanced error logging with error.response?.data
    const errorDetails = {
      error: error.message,
      url: url || 'N/A',
      operatorId: operatorId
    };
    
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.responseData = error.response?.data || {};
    }
    
    console.error('Failed to fetch bill:', errorDetails);
    
    // Save failed fetch attempt
    try {
      const failedFetch = new BbpsBillFetch({
        userId,
        operatorId,
        parameters,
        status: 'FAILED',
        errorCode: error.response?.status || error.code || 'FETCH_ERROR',
        errorMessage: error.message,
        idempotencyKey: idempotencyKey || generateIdempotencyKey('fetch')
      });
      await failedFetch.save();
    } catch (dbError) {
      console.error('Error saving failed fetch:', dbError);
    }
    
    throw new Error(`Failed to fetch bill: ${error.message}`);
  }
}

/**
 * Pay Bill
 * Processes bill payment using fetchReferenceId
 */
async function payBill(fetchReferenceId, amount, userId, paymentMethod = null, idempotencyKey = null) {
  try {
    // Validate fetch reference exists
    const billFetch = await BbpsBillFetch.findOne({ fetchReferenceId });
    if (!billFetch) {
      throw new Error(`Bill fetch not found for reference: ${fetchReferenceId}`);
    }
    
    // Check if bill is already paid
    const existingPayment = await BbpsBillPayment.findOne({ fetchReferenceId });
    if (existingPayment && existingPayment.status === 'SUCCESS') {
      throw new Error('Bill already paid successfully');
    }
    
    // Validate amount
    if (amount !== billFetch.billAmount) {
      throw new Error(`Amount mismatch. Expected: ${billFetch.billAmount}, Provided: ${amount}`);
    }
    
    // Check if fetch reference is expired
    if (billFetch.expiresAt && billFetch.expiresAt < new Date()) {
      throw new Error('Bill fetch reference has expired. Please fetch bill again.');
    }
    
    // Generate idempotency key if not provided
    const idempotency = idempotencyKey || generateIdempotencyKey('pay');
    
    // Check for duplicate payment request
    const existingPayRequest = await BbpsBillPayment.findOne({ idempotencyKey: idempotency });
    if (existingPayRequest) {
      return {
        success: true,
        data: existingPayRequest,
        message: 'Duplicate payment request - returning existing payment'
      };
    }
    
    // Build URL from config (production/staging based on EKO_ENV)
    const url = EKO_CONFIG.buildUrl(EKO_CONFIG.ENDPOINTS.PAY_BILL);
    
    // Prepare request payload
    const payload = {
      initiator_id: EKO_CONFIG.INITIATOR_ID,
      fetch_reference_id: fetchReferenceId,
      amount: amount.toString()
    };
    
    // Generate authentication headers
    const headers = generateEkoAuthHeaders();
    
    // Log the request
    console.log("=".repeat(80));
    console.log("payBill() - NEW CODE VERSION");
    console.log("URL:", url);
    console.log("Payload:", JSON.stringify(payload, null, 2));
    console.log("=".repeat(80));
    
    // Make POST request using axios directly
    const response = await axios.post(url, payload, {
      headers: headers,
      timeout: 30000
    });
    
    // Handle EKO response structure
    // Response might be: { "data": { ... } } or direct object
    const responseData = response.data?.data || response.data || response;
    const paymentStatus = responseData.status || 'PENDING';
    
    console.log("Pay Bill Response:", JSON.stringify(responseData, null, 2));
    
    // Save payment to database
    const billPayment = new BbpsBillPayment({
      userId,
      billFetchId: billFetch._id,
      fetchReferenceId,
      operatorId: billFetch.operatorId,
      operatorName: billFetch.operatorName,
      amount,
      ekoTransactionId: responseData.transactionId,
      ekoPaymentId: responseData.paymentId,
      status: paymentStatus,
      paymentMethod,
      ekoResponse: responseData,
      idempotencyKey: idempotency,
      paidAt: paymentStatus === 'SUCCESS' ? new Date() : null
    });
    
    await billPayment.save();
    
    // Update bill fetch status
    if (paymentStatus === 'SUCCESS') {
      billFetch.status = 'SUCCESS';
      await billFetch.save();
    }
    
    return {
      success: true,
      data: billPayment,
      message: `Payment ${paymentStatus === 'SUCCESS' ? 'processed successfully' : 'is pending'}`
    };
  } catch (error) {
    // Enhanced error logging with error.response?.data
    const errorDetails = {
      error: error.message,
      url: url || 'N/A',
      fetchReferenceId: fetchReferenceId
    };
    
    if (error.response) {
      errorDetails.status = error.response.status;
      errorDetails.responseData = error.response?.data || {};
    }
    
    console.error('Failed to pay bill:', errorDetails);
    
    // Save failed payment attempt
    try {
      const billFetch = await BbpsBillFetch.findOne({ fetchReferenceId }).catch(() => null);
      if (billFetch) {
        const failedPayment = new BbpsBillPayment({
          userId,
          billFetchId: billFetch._id,
          fetchReferenceId,
          operatorId: billFetch.operatorId,
          amount,
          status: 'FAILED',
          errorCode: error.response?.status || error.code || 'PAYMENT_ERROR',
          errorMessage: error.message,
          failureReason: error.message,
          idempotencyKey: idempotencyKey || generateIdempotencyKey('pay')
        });
        await failedPayment.save();
      }
    } catch (dbError) {
      console.error('Error saving failed payment:', dbError);
    }
    
    throw new Error(`Failed to pay bill: ${error.message}`);
  }
}

/**
 * Check Payment Status
 * Checks the status of a payment transaction
 */
async function checkPaymentStatus(transactionId) {
  try {
    const response = await makeEkoRequest(
      'GET',
      EKO_CONFIG.ENDPOINTS.CHECK_STATUS,
      null,
      { transactionId }
    );
    
    // Update payment in database if found
    const payment = await BbpsBillPayment.findOne({ ekoTransactionId: transactionId });
    if (payment && response.data) {
      const newStatus = response.data.status || payment.status;
      if (newStatus !== payment.status) {
        payment.status = newStatus;
        if (newStatus === 'SUCCESS') {
          payment.paidAt = new Date();
        }
        await payment.save();
      }
    }
    
    return {
      success: true,
      data: response.data || response
    };
  } catch (error) {
    throw new Error(`Failed to check payment status: ${error.message}`);
  }
}

// ============================================================================
// OPERATOR FILTERING UTILITIES
// ============================================================================

/**
 * Allowed Mobile Postpaid Operator IDs
 * Only operators with these IDs are allowed for Mobile Postpaid category
 */
const ALLOWED_OPERATOR_IDS = [
  172,  // Jio Postpaid
  615,  // Vi Postpaid
  41,   // Airtel Postpaid
  89,   // BSNL
  27,   // MTNL Delhi
  507,  // MTNL Mumbai Dolphin
  2995  // Wiwanet
];



/**
 * Filter Mobile Postpaid Operators
 * Filters operators to return ONLY operators with IDs in the allowed list.
 * 
 * Allowed Operator IDs:
 * - 172: Jio Postpaid
 * - 615: Vi Postpaid
 * - 41: Airtel Postpaid
 * - 89: BSNL
 * - 27: MTNL Delhi
 * - 507: MTNL Mumbai Dolphin
 * - 2995: Wiwanet
 * 
 * Note: This function filters by operator_id only. If API response includes
 * operator_category_name or status fields, those are logged for debugging
 * but don't affect the filter result.
 * 
 * @param {Array} operators - Array of operator objects from API
 * @returns {Array} Filtered array containing only allowed Mobile Postpaid operators
 */
function filterMobilePostpaidOperators(operators) {
  // Handle empty or invalid input
  if (!operators || !Array.isArray(operators)) {
    console.warn('filterMobilePostpaidOperators: Invalid input - expected array');
    return [];
  }

  // Debug: Log sample operator structure (first 3 operators)
  if (operators.length > 0) {
    console.log('Sample operator structure:', JSON.stringify(operators.slice(0, 3), null, 2));
  }

  // Debug: Find and log operators with allowed IDs to see their structure
  const allowedOperatorsSample = operators.filter((operator) => {
    const operatorId = operator.operator_id || operator.operatorId || operator.id;
    if (operatorId === undefined || operatorId === null) return false;
    const operatorIdNum = Number(operatorId);
    return !isNaN(operatorIdNum) && ALLOWED_OPERATOR_IDS.includes(operatorIdNum);
  }).slice(0, 5);

  if (allowedOperatorsSample.length > 0) {
    console.log('Allowed operator IDs found in response:', allowedOperatorsSample.map(op => ({
      operator_id: op.operator_id || op.operatorId || op.id,
      name: op.name || op.operator_name || op.operatorName,
      operator_category: op.operator_category,
      operator_category_name: op.operator_category_name || op.categoryName,
      status: op.status,
      all_fields: Object.keys(op)
    })));
  } else {
    console.log('No operators found with allowed IDs:', ALLOWED_OPERATOR_IDS);
  }

  // Filter operators based on strict criteria
  // PRIMARY FILTER: Only allow operators with IDs in the allowed list
  const filtered = operators.filter((operator) => {
    // Validate operator object structure
    if (!operator || typeof operator !== 'object') {
      return false;
    }

    // Get operator_id from multiple possible field names
    const operatorId = operator.operator_id || operator.operatorId || operator.id;
    if (operatorId === undefined || operatorId === null) {
      return false;
    }

    // Convert to number for comparison (handles string numbers)
    const operatorIdNum = Number(operatorId);
    if (isNaN(operatorIdNum)) {
      return false;
    }

    // PRIMARY CHECK: operator_id must be in allowed list
    // This is the main requirement - only these specific operators are allowed
    // [172, 615, 41, 89, 27, 507, 2995]
    return ALLOWED_OPERATOR_IDS.includes(operatorIdNum);
  });

  // Debug: Log operators with "Postpaid" in name but not in allowed list
  const postpaidButNotAllowed = operators.filter((operator) => {
    if (!operator || typeof operator !== 'object') return false;
    const operatorName = (operator.name || operator.operator_name || operator.operatorName || '').toLowerCase();
    const operatorId = operator.operator_id || operator.operatorId || operator.id;
    
    return operatorName.includes('postpaid') && 
           operatorId !== undefined && 
           operatorId !== null &&
           !ALLOWED_OPERATOR_IDS.includes(Number(operatorId));
  });

  if (postpaidButNotAllowed.length > 0) {
    console.log(`Found ${postpaidButNotAllowed.length} Postpaid operators (by name) not in allowed list:`, 
      postpaidButNotAllowed.slice(0, 10).map(op => ({
        id: op.operator_id || op.operatorId || op.id,
        name: op.name || op.operator_name || op.operatorName,
        category: op.operator_category_name || op.categoryName || op.operator_category
      }))
    );
  }

  console.log(`Filtered ${filtered.length} Mobile Postpaid operators from ${operators.length} total operators`);
  
  return filtered;
}

/**
 * Get Filtered Mobile Postpaid Operators
 * Fetches operators from API and returns only allowed Mobile Postpaid operators
 * 
 * @param {Object} filters - Optional filters for operator list API
 * @returns {Object} { success: boolean, data: Array }
 */
async function getMobilePostpaidOperators(filters = {}) {
  try {
    // Fetch all operators (or filtered by category if provided)
    const result = await getOperatorList(filters);
    
    // If API call failed, return error
    if (!result.success) {
      return result;
    }

    // Extract operators from response
    const operators = result.data || [];
    
    // Filter to only allowed Mobile Postpaid operators
    const filteredOperators = filterMobilePostpaidOperators(operators);
    
    return {
      success: true,
      data: filteredOperators,
      message: `Found ${filteredOperators.length} allowed Mobile Postpaid operators`
    };
  } catch (error) {
    console.error('Failed to get Mobile Postpaid operators:', error);
    throw new Error(`Failed to get Mobile Postpaid operators: ${error.message}`);
  }
}
  const ALLOWED_OPERATOR_ID_SET =[
  5,
  1,
  90,
  91,
  400
];

function filterMobilePrepaidOperators(operators) {
  if (!operators || !Array.isArray(operators)) {
    console.warn('filterMobilePrepaidOperators: Invalid input - expected array');
    return [];
  }

  // Debug sample
  if (operators.length > 0) {
    console.log('Sample prepaid operator structure:', JSON.stringify(operators.slice(0, 3), null, 2));
  }

  const filtered = operators.filter((operator) => {
    if (!operator || typeof operator !== 'object') return false;

    const operatorId = operator.operator_id || operator.operatorId || operator.id;
    if (operatorId === undefined || operatorId === null) return false;

    const operatorIdNum = Number(operatorId);
    if (isNaN(operatorIdNum)) return false;

    return ALLOWED_OPERATOR_ID_SET.includes(operatorIdNum);
  });

  console.log(`Filtered ${filtered.length} Mobile Prepaid operators from ${operators.length} total operators`);

  return filtered;
}

async function getMobilePrepaidOperators(filters = {}) {
  try {
    const result = await getOperatorList(filters);

    if (!result.success) {
      return result;
    }

    const operators = result.data || [];

    const filteredOperators = filterMobilePrepaidOperators(operators);

    return {
      success: true,
      data: filteredOperators,
      message: `Found ${filteredOperators.length} allowed Mobile Prepaid operators`
    };
  } catch (error) {
    console.error('Failed to get Mobile Prepaid operators:', error);
    throw new Error(`Failed to get Mobile Prepaid operators: ${error.message}`);
  }
}


module.exports = {
  // Operator APIs
  getOperatorCategories,
  getOperatorLocations,
  getOperatorList,
  getOperatorParameters,
  getMobilePostpaidOperators,
  filterMobilePostpaidOperators,
  filterMobilePrepaidOperators,
  getMobilePrepaidOperators,
  // Bill Operations
  fetchBill,
  payBill,
  checkPaymentStatus
};