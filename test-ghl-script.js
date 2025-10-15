#!/usr/bin/env node

/**
 * GHL API Key Test Script
 * 
 * This script tests GHL API keys to check if they can create sub-accounts.
 * 
 * Usage:
 *   node test-ghl-script.js <api_key>
 *   node test-ghl-script.js <api_key> --test-data='{"businessName":"Test Org"}'
 * 
 * Examples:
 *   node test-ghl-script.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *   node test-ghl-script.js pit-f397ad9f-cf11-49b8-a791-658b934ec3f6
 */

const axios = require('axios');

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
  console.log(colorize('🔑 GHL API Key Test Script', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
  console.log();
}

function printKeyAnalysis(apiKey) {
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
}

function printTestData(testData) {
  console.log(colorize('📋 Test Data:', 'blue'));
  console.log(JSON.stringify(testData, null, 2));
  console.log();
}

async function testGHLKey(apiKey, testData) {
  const baseURL = process.env.GHL_BASE_URL || 'https://rest.gohighlevel.com/v1';
  
  console.log(colorize('🚀 Testing GHL API Key...', 'yellow'));
  console.log(`   API Endpoint: ${baseURL}/locations/`);
  console.log(`   Key: ${apiKey.substring(0, 20)}...`);
  console.log();
  
  try {
    const response = await axios.post(`${baseURL}/locations/`, testData, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28'
      },
      timeout: 30000 // 30 second timeout
    });
    
    console.log(colorize('✅ SUCCESS!', 'green'));
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   Location ID: ${response.data.id || response.data.locationId || 'N/A'}`);
    console.log(`   Response:`, JSON.stringify(response.data, null, 2));
    
    return {
      success: true,
      status: response.status,
      data: response.data,
      locationId: response.data.id || response.data.locationId
    };
    
  } catch (error) {
    console.log(colorize('❌ FAILED!', 'red'));
    
    if (error.response) {
      console.log(`   Status: ${error.response.status} ${error.response.statusText}`);
      console.log(`   Error: ${error.response.data?.message || 'Unknown error'}`);
      console.log(`   Details:`, JSON.stringify(error.response.data, null, 2));
      
      // Provide troubleshooting info
      console.log();
      console.log(colorize('🔧 Troubleshooting:', 'yellow'));
      
      const status = error.response.status;
      const message = error.response.data?.message || '';
      
      if (status === 401) {
        if (message.includes('Invalid JWT')) {
          console.log('   • The API key is expired, invalid, or not the right type');
          console.log('   • Check if you need an Agency API key instead of Location key');
        } else {
          console.log('   • The API key is invalid or expired');
        }
      } else if (status === 403) {
        console.log('   • The API key is a Location key, not an Agency key');
        console.log('   • Location keys cannot create sub-accounts');
        console.log('   • You need an Agency API key for sub-account creation');
      } else if (status === 400) {
        console.log('   • The request data is invalid');
        console.log('   • Check the test data format');
      } else {
        console.log('   • Unknown error - check the error details above');
      }
      
      return {
        success: false,
        status: status,
        error: message,
        details: error.response.data
      };
      
    } else if (error.code === 'ECONNABORTED') {
      console.log('   Error: Request timeout (30 seconds)');
      console.log('   • The GHL API is not responding');
      console.log('   • Check your internet connection');
      
      return {
        success: false,
        error: 'Request timeout',
        details: 'GHL API not responding'
      };
      
    } else {
      console.log(`   Error: ${error.message}`);
      console.log('   • Network error or invalid URL');
      
      return {
        success: false,
        error: error.message,
        details: 'Network error'
      };
    }
  }
}

function printUsage() {
  console.log(colorize('📖 Usage:', 'blue'));
  console.log('   node test-ghl-script.js <api_key>');
  console.log('   node test-ghl-script.js <api_key> --test-data=\'{"businessName":"Test Org"}\'');
  console.log();
  console.log(colorize('📝 Examples:', 'blue'));
  console.log('   node test-ghl-script.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  console.log('   node test-ghl-script.js pit-f397ad9f-cf11-49b8-a791-658b934ec3f6');
  console.log();
  console.log(colorize('🔑 Key Types:', 'blue'));
  console.log('   • Personal Access Token: ~50 chars, pit-xxxxxxxx format');
  console.log('   • Location API Key: ~200-300 chars, JWT format');
  console.log('   • Agency API Key: 250+ chars, JWT format (CAN create sub-accounts)');
  console.log();
}

async function main() {
  printHeader();
  
  // Parse command line arguments
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
  
  // Parse test data if provided
  let testData = {
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
  };
  
  // Check for custom test data
  const testDataArg = args.find(arg => arg.startsWith('--test-data='));
  if (testDataArg) {
    try {
      const customData = JSON.parse(testDataArg.split('=')[1]);
      testData = { ...testData, ...customData };
    } catch (error) {
      console.log(colorize('❌ Error: Invalid test data JSON', 'red'));
      process.exit(1);
    }
  }
  
  // Analyze the API key
  printKeyAnalysis(apiKey);
  
  // Show test data
  printTestData(testData);
  
  // Test the API key
  const result = await testGHLKey(apiKey, testData);
  
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

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.log(colorize('❌ Uncaught Exception:', 'red'));
  console.log(error.message);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.log(colorize('❌ Unhandled Rejection:', 'red'));
  console.log(reason);
  process.exit(1);
});

// Run the main function
main().catch(error => {
  console.log(colorize('❌ Script Error:', 'red'));
  console.log(error.message);
  process.exit(1);
});
