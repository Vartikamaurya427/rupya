/**
 * EKO BBPS API Configuration
 * Staging Base URL: https://staging.eko.in/ekoapi/v2
 * Production Base URL: (set via EKO_PRODUCTION_URL)
 * 
 * Full URL = Base URL + API Endpoint (as per EKO docs)
 * Example: https://staging.eko.in/ekoapi/v2/billpayments/operators_category
 */

require('dotenv').config();

const EKO_CONFIG = {
  // Base URLs
  // IMPORTANT:
  // - For staging: https://staging.eko.in/ekoapi/v2
  // - For production: set EKO_PRODUCTION_URL to your assigned base URL (must include /ekoapi/v2 if required)
  BASE_URL_STAGING: process.env.EKO_STAGING_URL || 'https://staging.eko.in/ekoapi/v2',
  BASE_URL_PRODUCTION: process.env.EKO_PRODUCTION_URL,
  
  // Credentials (from environment variables)
  DEVELOPER_KEY: process.env.DEVELOPER_KEY || 'b6722d770f4d9f4dac1a1d98843fd2ab',
  INITIATOR_ID: process.env.INITIATOR_ID || '8860014004',
  AUTHENTICATOR_KEY: process.env.AUTHENTICATOR_KEY || '5b572cea-769a-4e92-8efc-b1f6e7d99237',
  
  // API Endpoints
  // Based on EKO Developer Documentation:
  // https://developers.eko.in/docs/bbps
  ENDPOINTS: {
    // Operator APIs
    GET_OPERATOR_CATEGORIES: '/billpayments/operators_category',
    GET_OPERATOR_LOCATIONS: '/billpayments/operators_location',
    GET_OPERATOR_LIST: '/billpayments/operators', // query: operator_category_id, location_id
    GET_OPERATOR_PARAMETERS: '/billpayments/operators/{operatorId}',
    
    // Bill Operations
    FETCH_BILL: '/billpayments/fetchbill',
    PAY_BILL: '/billpayments/paybill',
    
    // Status Check
    CHECK_STATUS: '/billpayments/transaction/{transactionId}/status', // Verify this endpoint
  },
  
  // Environment (staging/production)
  // Set EKO_ENV=production in .env file for production
  // Default to production if production URL is present, else staging
  ENV: process.env.EKO_ENV || (process.env.EKO_PRODUCTION_URL ? 'production' : 'staging'),
  
  // Get current base URL based on environment
  getBaseUrl() {
    const baseUrl = this.ENV === 'production'
      ? this.BASE_URL_PRODUCTION
      : this.BASE_URL_STAGING;

    if (this.ENV === 'production' && !this.BASE_URL_PRODUCTION) {
      throw new Error('EKO_PRODUCTION_URL is not set but EKO_ENV=production');
    }
    
    // Debug logging
    console.log(`🌍 EKO Environment: ${this.ENV}`);
    console.log(`🔗 EKO Base URL: ${baseUrl}`);
    
    return baseUrl;
  },
  
  // Build full URL
  buildUrl(endpoint, params = {}) {
    const baseUrl = this.getBaseUrl();
    let url = baseUrl + endpoint;
    
    // Replace path parameters
    Object.keys(params).forEach(key => {
      url = url.replace(`{${key}}`, params[key]);
    });
    
    // Debug: Log the final URL
    console.log(`📝 Building URL: ${baseUrl} + ${endpoint} = ${url}`);
    
    return url;
  }
};

module.exports = EKO_CONFIG;

