const https = require('https');

// Color output functions
function colorize(text, color) {
  const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    reset: '\x1b[0m'
  };
  return `${colors[color] || colors.reset}${text}${colors.reset}`;
}

function createContactWithSubAccountKey(locationId, subAccountApiKey, contactData) {
  return new Promise((resolve, reject) => {
    const contactPayload = JSON.stringify(contactData);
    
    const options = {
      hostname: 'rest.gohighlevel.com',
      port: 443,
      path: '/v1/contacts/',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${subAccountApiKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28',
        'Location-Id': locationId
      },
      timeout: 30000
    };

    console.log(colorize('👤 Creating Contact with Sub-Account API Key...', 'yellow'));
    console.log(`   Endpoint: https://rest.gohighlevel.com/v1/contacts/`);
    console.log(`   Location ID: ${locationId}`);
    console.log(`   Sub-Account API Key: ${subAccountApiKey.substring(0, 20)}...`);
    console.log(`   Contact Name: ${contactData.firstName} ${contactData.lastName}`);
    console.log(`   Contact Email: ${contactData.email}`);
    console.log();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200 || res.statusCode === 201) {
            console.log(colorize('✅ CONTACT CREATED SUCCESSFULLY!', 'green'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Contact ID: ${response.id || response.contactId || 'N/A'}`);
            console.log(`   Contact Name: ${response.firstName || ''} ${response.lastName || ''}`);
            console.log(`   Contact Email: ${response.email || 'N/A'}`);
            console.log(`   Contact Phone: ${response.phone || 'N/A'}`);
            resolve({ success: true, contactId: response.id || response.contactId, data: response });
          } else {
            console.log(colorize('❌ CONTACT CREATION FAILED!', 'red'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Error: ${response.message || response.error || 'Unknown error'}`);
            console.log(`   Details: ${JSON.stringify(response, null, 2)}`);
            resolve({ success: false, error: response.message || response.error || 'Unknown error', details: response });
          }
        } catch (parseError) {
          console.log(colorize('❌ PARSE ERROR!', 'red'));
          console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
          console.log(`   Parse Error: ${parseError.message}`);
          console.log(`   Raw Response: ${data}`);
          resolve({ success: false, error: 'Parse error', details: data });
        }
      });
    });

    req.on('error', (error) => {
      console.log(colorize('❌ NETWORK ERROR!', 'red'));
      console.log(`   Error: ${error.message}`);
      reject(error);
    });

    req.on('timeout', () => {
      console.log(colorize('❌ TIMEOUT ERROR!', 'red'));
      console.log('   Request timed out after 30 seconds');
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(contactPayload);
    req.end();
  });
}

async function main() {
  const locationId = process.argv[2];
  const subAccountApiKey = process.argv[3];
  
  if (!locationId || !subAccountApiKey) {
    console.log(colorize('❌ Usage: node test-ghl-subaccount-api-key.js <LOCATION_ID> <SUB_ACCOUNT_API_KEY>', 'red'));
    console.log(colorize('   Example: node test-ghl-subaccount-api-key.js "X81NB66F6ZHVSEjfGHrI" "eyJhbGciOiJIUzI1NiIs..."', 'yellow'));
    console.log(colorize('\n💡 To get a sub-account API key:', 'cyan'));
    console.log('   1. Create a GHL sub-account using the organization signup');
    console.log('   2. The API key will be returned in the response');
    console.log('   3. It will be stored in the gHLAccount.api_key field');
    process.exit(1);
  }

  console.log(colorize('🔑 GHL Sub-Account API Key Contact Creation Test', 'cyan'));
  console.log(colorize('===============================================', 'cyan'));
  console.log(`   Location ID: ${locationId}`);
  console.log(`   Sub-Account API Key: ${subAccountApiKey.substring(0, 20)}...`);
  console.log();

  try {
    const timestamp = Date.now();
    const contactData = {
      firstName: `Test`,
      lastName: `Contact ${timestamp}`,
      email: `test.contact.${timestamp}@example.com`,
      phone: '+1-555-123-4567',
      address: '123 Test Street',
      city: 'Test City',
      state: 'TS',
      country: 'US',
      postalCode: '12345',
      tags: ['test', 'sub-account-api-key'],
      source: 'test-script'
    };
    
    const contactResult = await createContactWithSubAccountKey(locationId, subAccountApiKey, contactData);
    
    if (!contactResult.success) {
      console.log(colorize('\n❌ Test failed!', 'red'));
      console.log(`   Error: ${contactResult.error}`);
      return;
    }
    
    console.log(colorize('\n📊 Final Results:', 'cyan'));
    console.log(colorize('🎉 Test completed successfully!', 'green'));
    console.log(`   ✅ Contact created with ID: ${contactResult.contactId}`);
    console.log(`   📧 Contact email: ${contactData.email}`);
    console.log(`   📱 Contact phone: ${contactData.phone}`);
    
    console.log(colorize('\n💡 Implementation Notes:', 'cyan'));
    console.log('   • Sub-account API keys can create contacts directly');
    console.log('   • No need for location token generation');
    console.log('   • More efficient than the two-step process');
    console.log('   • API key is stored in gHLAccount.api_key field');
    
  } catch (error) {
    console.log(colorize('❌ Test error:', 'red'));
    console.log(`   ${error.message}`);
  }
}

main().catch(console.error);
