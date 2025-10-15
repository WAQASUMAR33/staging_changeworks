#!/usr/bin/env node

/**
 * Simple GHL API Key Test Script
 * 
 * This script tests GHL API keys using Node.js built-in modules.
 * 
 * Usage:
 *   node test-ghl-simple.js <api_key>
 */

const https = require('https');
const http = require('http');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function colorize(text, color) {
  return `${colors[color]}${text}${colors.reset}`;
}

function printHeader() {
  console.log(colorize('🔑 Simple GHL API Key Test', 'cyan'));
  console.log(colorize('=' .repeat(40), 'cyan'));
  console.log();
}

function analyzeKey(apiKey) {
  console.log(colorize('📊 Key Analysis:', 'blue'));
  console.log(`   Length: ${apiKey.length} characters`);
  
  let keyType = 'Unknown';
  let canCreateSubAccounts = false;
  
  if (apiKey.startsWith('pit-') && apiKey.length < 100) {
    keyType = 'Personal Access Token (PAT)';
    canCreateSubAccounts = false;
  } else if (apiKey.length > 200 && apiKey.length < 300) {
    keyType = 'Location API Key (JWT)';
    canCreateSubAccounts = false;
  } else if (apiKey.length >= 300) {
    keyType = 'Agency API Key (JWT)';
    canCreateSubAccounts = true;
  }
  
  console.log(`   Type: ${keyType}`);
  console.log(`   Can create sub-accounts: ${canCreateSubAccounts ? colorize('✅ Yes', 'green') : colorize('❌ No', 'red')}`);
  console.log();
  
  return { keyType, canCreateSubAccounts };
}

function makeRequest(apiKey) {
  return new Promise((resolve, reject) => {
    const testData = JSON.stringify({
      name: "Test Organization",
      phone: "1234567890",
      companyId: "HegBO6PzXMfyDn0yFiFn",
      address: "123 Test Street",
      city: "Test City",
      state: "Test State",
      country: "US",
      postalCode: "12345",
      website: "https://test.com",
      timezone: "America/New_York",
      prospectInfo: {
        firstName: "Test",
        lastName: "Organization",
        email: "test@example.com"
      }
    });

    const subAccountApiUrl = process.env.GHL_SUB_ACCOUNT_CREATION_API_URL || 'https://rest.gohighlevel.com/v1/locations/';
    const url = new URL(subAccountApiUrl);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28',
        'Content-Length': Buffer.byteLength(testData)
      },
      timeout: 30000
    };

    console.log(colorize('🚀 Testing GHL API Key...', 'yellow'));
    console.log(`   Endpoint: ${subAccountApiUrl}`);
    console.log(`   Key: ${apiKey.substring(0, 20)}...`);
    console.log();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const responseData = JSON.parse(data);
          
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(colorize('✅ SUCCESS!', 'green'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Location ID: ${responseData.id || responseData.locationId || 'N/A'}`);
            console.log(`   Response:`, JSON.stringify(responseData, null, 2));
            
            resolve({
              success: true,
              status: res.statusCode,
              data: responseData,
              locationId: responseData.id || responseData.locationId
            });
          } else {
            console.log(colorize('❌ FAILED!', 'red'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Error: ${responseData.message || 'Unknown error'}`);
            console.log(`   Details:`, JSON.stringify(responseData, null, 2));
            
            console.log();
            console.log(colorize('🔧 Troubleshooting:', 'yellow'));
            
            if (res.statusCode === 401) {
              if (responseData.message && responseData.message.includes('Invalid JWT')) {
                console.log('   • The API key is expired, invalid, or not the right type');
                console.log('   • Check if you need an Agency API key instead of Location key');
              } else {
                console.log('   • The API key is invalid or expired');
              }
            } else if (res.statusCode === 403) {
              console.log('   • The API key is a Location key, not an Agency key');
              console.log('   • Location keys cannot create sub-accounts');
              console.log('   • You need an Agency API key for sub-account creation');
            } else if (res.statusCode === 400) {
              console.log('   • The request data is invalid');
              console.log('   • Check the test data format');
            } else {
              console.log('   • Unknown error - check the error details above');
            }
            
            resolve({
              success: false,
              status: res.statusCode,
              error: responseData.message || 'Unknown error',
              details: responseData
            });
          }
        } catch (error) {
          console.log(colorize('❌ FAILED!', 'red'));
          console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
          console.log(`   Error: Invalid JSON response`);
          console.log(`   Raw response:`, data);
          
          resolve({
            success: false,
            status: res.statusCode,
            error: 'Invalid JSON response',
            details: data
          });
        }
      });
    });

    req.on('error', (error) => {
      console.log(colorize('❌ FAILED!', 'red'));
      console.log(`   Error: ${error.message}`);
      console.log('   • Network error or invalid URL');
      
      resolve({
        success: false,
        error: error.message,
        details: 'Network error'
      });
    });

    req.on('timeout', () => {
      console.log(colorize('❌ FAILED!', 'red'));
      console.log('   Error: Request timeout (30 seconds)');
      console.log('   • The GHL API is not responding');
      console.log('   • Check your internet connection');
      
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout',
        details: 'GHL API not responding'
      });
    });

    req.write(testData);
    req.end();
  });
}

function printUsage() {
  console.log(colorize('📖 Usage:', 'blue'));
  console.log('   node test-ghl-simple.js <api_key>');
  console.log();
  console.log(colorize('📝 Examples:', 'blue'));
  console.log('   node test-ghl-simple.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  console.log('   node test-ghl-simple.js pit-f397ad9f-cf11-49b8-a791-658b934ec3f6');
  console.log();
  console.log(colorize('🔑 Key Types:', 'blue'));
  console.log('   • Personal Access Token: ~50 chars, pit-xxxxxxxx format');
  console.log('   • Location API Key: ~200-300 chars, JWT format');
  console.log('   • Agency API Key: 250+ chars, JWT format (CAN create sub-accounts)');
  console.log();
}

async function main() {
  printHeader();
  
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  
  const apiKey = args[0];
  
  if (!apiKey) {
    console.log(colorize('❌ Error: API key is required', 'red'));
    printUsage();
    process.exit(1);
  }
  
  // Analyze the API key
  const analysis = analyzeKey(apiKey);
  
  // Test the API key
  const result = await makeRequest(apiKey);
  
  console.log();
  console.log(colorize('📊 Final Result:', 'blue'));
  if (result.success) {
    console.log(colorize('✅ API key is valid and can create GHL sub-accounts!', 'green'));
    console.log(`   Location ID: ${result.locationId}`);
  } else {
    console.log(colorize('❌ API key cannot create GHL sub-accounts', 'red'));
    console.log(`   Error: ${result.error}`);
  }
  
  console.log();
  process.exit(result.success ? 0 : 1);
}

// Run the main function
main().catch(error => {
  console.log(colorize('❌ Script Error:', 'red'));
  console.log(error.message);
  process.exit(1);
});
