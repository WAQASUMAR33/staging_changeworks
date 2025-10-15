#!/usr/bin/env node

/**
 * GHL Account Creation Test Script
 * 
 * This script tests GHL API keys by attempting to create a real sub-account.
 * 
 * Usage:
 *   node test-ghl-create-account.js <api_key>
 *   node test-ghl-create-account.js <api_key> --cleanup
 */

const https = require('https');

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
  console.log(colorize('🏢 GHL Account Creation Test', 'cyan'));
  console.log(colorize('=' .repeat(50), 'cyan'));
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

function createTestAccount(apiKey) {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const testData = JSON.stringify({
      name: `Test Account ${timestamp}`,
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
        lastName: "Account",
        email: `test-${timestamp}@example.com`
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

    console.log(colorize('🚀 Creating GHL Test Account...', 'yellow'));
    console.log(`   Endpoint: ${subAccountApiUrl}`);
    console.log(`   Key: ${apiKey.substring(0, 20)}...`);
    console.log(`   Account Name: Test Account ${timestamp}`);
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
            console.log(colorize('✅ ACCOUNT CREATED SUCCESSFULLY!', 'green'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Location ID: ${responseData.id || responseData.locationId || 'N/A'}`);
            console.log(`   Account Name: ${responseData.name || 'N/A'}`);
            console.log(`   Email: ${responseData.email || 'N/A'}`);
            console.log(`   Phone: ${responseData.phone || 'N/A'}`);
            console.log(`   Full Response:`, JSON.stringify(responseData, null, 2));
            
            resolve({
              success: true,
              status: res.statusCode,
              data: responseData,
              locationId: responseData.id || responseData.locationId,
              accountName: responseData.name,
              cleanup: {
                locationId: responseData.id || responseData.locationId,
                name: responseData.name
              }
            });
          } else {
            console.log(colorize('❌ ACCOUNT CREATION FAILED!', 'red'));
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
            } else if (res.statusCode === 422) {
              console.log('   • Validation error - check the data format');
              console.log('   • The account name or email might already exist');
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
          console.log(colorize('❌ ACCOUNT CREATION FAILED!', 'red'));
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
      console.log(colorize('❌ ACCOUNT CREATION FAILED!', 'red'));
      console.log(`   Error: ${error.message}`);
      console.log('   • Network error or invalid URL');
      
      resolve({
        success: false,
        error: error.message,
        details: 'Network error'
      });
    });

    req.on('timeout', () => {
      console.log(colorize('❌ ACCOUNT CREATION FAILED!', 'red'));
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

function deleteTestAccount(apiKey, locationId) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'rest.gohighlevel.com',
      port: 443,
      path: `/locations/${locationId}`,
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Version': '2021-07-28'
      },
      timeout: 30000
    };

    console.log(colorize('🗑️  Cleaning up test account...', 'yellow'));
    console.log(`   Location ID: ${locationId}`);
    console.log();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(colorize('✅ Test account deleted successfully!', 'green'));
          resolve({ success: true, status: res.statusCode });
        } else {
          console.log(colorize('⚠️  Could not delete test account', 'yellow'));
          console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
          console.log(`   Note: You may need to delete it manually from GHL dashboard`);
          resolve({ success: false, status: res.statusCode });
        }
      });
    });

    req.on('error', (error) => {
      console.log(colorize('⚠️  Cleanup failed', 'yellow'));
      console.log(`   Error: ${error.message}`);
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log(colorize('⚠️  Cleanup timeout', 'yellow'));
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.end();
  });
}

function printUsage() {
  console.log(colorize('📖 Usage:', 'blue'));
  console.log('   node test-ghl-create-account.js <api_key>');
  console.log('   node test-ghl-create-account.js <api_key> --cleanup');
  console.log();
  console.log(colorize('📝 Examples:', 'blue'));
  console.log('   node test-ghl-create-account.js eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  console.log('   node test-ghl-create-account.js pit-f397ad9f-cf11-49b8-a791-658b934ec3f6 --cleanup');
  console.log();
  console.log(colorize('🔑 Key Types:', 'blue'));
  console.log('   • Personal Access Token: ~50 chars, pit-xxxxxxxx format');
  console.log('   • Location API Key: ~200-300 chars, JWT format');
  console.log('   • Agency API Key: 250+ chars, JWT format (CAN create sub-accounts)');
  console.log();
  console.log(colorize('⚠️  Important:', 'yellow'));
  console.log('   • This script creates REAL GHL accounts');
  console.log('   • Use --cleanup flag to automatically delete test accounts');
  console.log('   • Test accounts are created with unique timestamps');
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
  const shouldCleanup = args.includes('--cleanup');
  
  if (!apiKey) {
    console.log(colorize('❌ Error: API key is required', 'red'));
    printUsage();
    process.exit(1);
  }
  
  // Analyze the API key
  const analysis = analyzeKey(apiKey);
  
  if (!analysis.canCreateSubAccounts) {
    console.log(colorize('⚠️  Warning: This key type cannot create sub-accounts', 'yellow'));
    console.log('   The test will likely fail, but we can still try...');
    console.log();
  }
  
  // Create test account
  const result = await createTestAccount(apiKey);
  
  // Cleanup if requested and account was created
  if (shouldCleanup && result.success && result.locationId) {
    console.log();
    await deleteTestAccount(apiKey, result.locationId);
  }
  
  console.log();
  console.log(colorize('📊 Final Result:', 'blue'));
  
  if (result.success) {
    console.log(colorize('✅ GHL API key can create sub-accounts!', 'green'));
    console.log(`   Location ID: ${result.locationId}`);
    console.log(`   Account Name: ${result.accountName}`);
    
    if (!shouldCleanup) {
      console.log();
      console.log(colorize('⚠️  Note:', 'yellow'));
      console.log('   A test account was created and is still active.');
      console.log('   Run with --cleanup flag to delete it automatically.');
      console.log(`   Or delete it manually from GHL dashboard: ${result.locationId}`);
    }
  } else {
    console.log(colorize('❌ GHL API key cannot create sub-accounts', 'red'));
    console.log(`   Error: ${result.error}`);
    
    if (result.status === 403) {
      console.log();
      console.log(colorize('💡 Solution:', 'cyan'));
      console.log('   You need an Agency API key to create sub-accounts.');
      console.log('   Location API keys can only manage existing accounts.');
    }
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
