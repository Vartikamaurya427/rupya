/**
 * EKO BBPS Authentication Utility
 * 
 * Security 2.0 Authentication:
 * - Every API request MUST include:
 *   1. developer_key
 *   2. secret-key (HMAC SHA256 signature)
 *   3. secret-key-timestamp (current timestamp in milliseconds)
 * 
 * secret-key generation:
 * 1. Base64 encode AUTHENTICATOR_KEY
 * 2. Generate current timestamp in milliseconds
 * 3. Generate HMAC SHA256 signature (message: timestamp, key: base64EncodedAuthenticatorKey)
 * 4. Base64 encode the signature → secret-key
 */

const crypto = require('crypto');
const EKO_CONFIG = require('../config/eko');

/**
 * Generate EKO authentication headers for API requests
 * 
 * @returns {Object} Headers object with developer_key, secret-key, and secret-key-timestamp
 */
function generateEkoAuthHeaders() {
  try {
    const authenticatorKey = EKO_CONFIG.AUTHENTICATOR_KEY;
    
    // Step 1: Base64 encode AUTHENTICATOR_KEY
    const encodedKey = Buffer.from(authenticatorKey).toString('base64');
    
    // Step 2: Generate current timestamp in milliseconds
    const timestamp = Date.now().toString();
    
    // Step 3: Generate HMAC SHA256 signature
    // Message: timestamp
    // Key: base64EncodedAuthenticatorKey
    const signature = crypto
      .createHmac('sha256', encodedKey)
      .update(timestamp)
      .digest('base64');
    
    // Step 4: Return headers object
    return {
      'developer_key': EKO_CONFIG.DEVELOPER_KEY,
      'secret-key': signature,
      'secret-key-timestamp': timestamp,
      'Content-Type': 'application/json'
    };
  } catch (error) {
    throw new Error(`Failed to generate EKO auth headers: ${error.message}`);
  }
}

/**
 * Validate EKO response and handle common errors
 * 
 * @param {Object} response - Axios response object
 * @returns {Object} Parsed response data
 * @throws {Error} If response indicates an error
 */
function validateEkoResponse(response) {
  const { data, status } = response;
  
  // Check HTTP status
  if (status !== 200 && status !== 201) {
    throw new Error(`EKO API returned status ${status}: ${JSON.stringify(data)}`);
  }
  
  // Check for error in response body
  if (data && data.status && data.status.toLowerCase() === 'error') {
    const errorMessage = data.message || data.error || 'Unknown EKO API error';
    const errorCode = data.errorCode || data.code || 'UNKNOWN_ERROR';
    
    // Handle specific error codes
    if (errorCode === 'UNAUTHORIZED_IP' || errorMessage.includes('IP')) {
      throw new Error('UNAUTHORIZED_IP: Your IP address is not whitelisted in EKO developer portal');
    }
    
    if (errorCode === 'INVALID_SECRET_KEY' || errorMessage.includes('secret-key')) {
      throw new Error('INVALID_SECRET_KEY: Authentication failed. Check AUTHENTICATOR_KEY');
    }
    
    if (errorCode === 'TIMESTAMP_MISMATCH' || errorMessage.includes('timestamp')) {
      throw new Error('TIMESTAMP_MISMATCH: Request timestamp is invalid or expired');
    }
    
    throw new Error(`EKO API Error [${errorCode}]: ${errorMessage}`);
  }
  
  return data;
}

module.exports = {
  generateEkoAuthHeaders,
  validateEkoResponse
};

