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

function generateLocationToken(locationId, agencyToken) {
  return new Promise((resolve, reject) => {
    const tokenData = JSON.stringify({
      locationId: locationId
    });
    
    const options = {
      hostname: 'services.leadconnectorhq.com',
      port: 443,
      path: '/oauth/locationToken',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${agencyToken}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      timeout: 30000
    };

    console.log(colorize('🔑 Generating Location Token...', 'yellow'));
    console.log(`   Endpoint: https://services.leadconnectorhq.com/oauth/locationToken`);
    console.log(`   Location ID: ${locationId}`);
    console.log(`   Agency Token: ${agencyToken.substring(0, 20)}...`);
    console.log();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200 && response.access_token) {
            console.log(colorize('✅ LOCATION TOKEN GENERATED SUCCESSFULLY!', 'green'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Access Token: ${response.access_token.substring(0, 20)}...`);
            console.log(`   Token Type: ${response.token_type || 'Bearer'}`);
            console.log(`   Expires In: ${response.expires_in || 'N/A'} seconds`);
            resolve({ success: true, accessToken: response.access_token, data: response });
          } else {
            console.log(colorize('❌ LOCATION TOKEN GENERATION FAILED!', 'red'));
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

    req.write(tokenData);
    req.end();
  });
}

function createContactWithToken(locationId, locationToken, contactData) {
  return new Promise((resolve, reject) => {
    const contactPayload = JSON.stringify(contactData);
    
    const options = {
      hostname: 'rest.gohighlevel.com',
      port: 443,
      path: '/v1/contacts/',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${locationToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Version': '2021-07-28',
        'Location-Id': locationId
      },
      timeout: 30000
    };

    console.log(colorize('👤 Creating Contact with Location Token...', 'yellow'));
    console.log(`   Endpoint: https://rest.gohighlevel.com/v1/contacts/`);
    console.log(`   Location ID: ${locationId}`);
    console.log(`   Location Token: ${locationToken.substring(0, 20)}...`);
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
  const agencyToken = process.argv[3];
  
  if (!locationId || !agencyToken) {
    console.log(colorize('❌ Usage: node test-ghl-location-token.js <LOCATION_ID> <AGENCY_TOKEN>', 'red'));
    console.log(colorize('   Example: node test-ghl-location-token.js "X81NB66F6ZHVSEjfGHrI" "eyJhbGciOiJIUzI1NiIs..."', 'yellow'));
    process.exit(1);
  }

  console.log(colorize('🔑 GHL Location Token & Contact Creation Test', 'cyan'));
  console.log(colorize('=============================================', 'cyan'));
  console.log(`   Location ID: ${locationId}`);
  console.log(`   Agency Token: ${agencyToken.substring(0, 20)}...`);
  console.log();

  try {
    // Step 1: Generate location token
    console.log(colorize('STEP 1: Generating Location Token', 'magenta'));
    console.log(colorize('================================', 'magenta'));
    
    const tokenResult = await generateLocationToken(locationId, agencyToken);
    
    if (!tokenResult.success) {
      console.log(colorize('\n❌ Test failed at Step 1!', 'red'));
      console.log(`   Error: ${tokenResult.error}`);
      return;
    }
    
    console.log(colorize('\n✅ Step 1 completed successfully!', 'green'));
    
    // Step 2: Create contact using the location token
    console.log(colorize('\nSTEP 2: Creating Contact with Location Token', 'magenta'));
    console.log(colorize('=============================================', 'magenta'));
    
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
      tags: ['test', 'location-token'],
      source: 'test-script'
    };
    
    const contactResult = await createContactWithToken(locationId, tokenResult.accessToken, contactData);
    
    if (!contactResult.success) {
      console.log(colorize('\n❌ Test failed at Step 2!', 'red'));
      console.log(`   Error: ${contactResult.error}`);
      return;
    }
    
    console.log(colorize('\n✅ Step 2 completed successfully!', 'green'));
    
    // Final results
    console.log(colorize('\n📊 Final Results:', 'cyan'));
    console.log(colorize('🎉 Test completed successfully!', 'green'));
    console.log(`   ✅ Location token generated`);
    console.log(`   ✅ Contact created with ID: ${contactResult.contactId}`);
    console.log(`   📧 Contact email: ${contactData.email}`);
    
  } catch (error) {
    console.log(colorize('❌ Test error:', 'red'));
    console.log(`   ${error.message}`);
  }
}

main().catch(console.error);
