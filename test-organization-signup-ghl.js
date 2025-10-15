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

function testOrganizationSignup(baseUrl) {
  return new Promise((resolve, reject) => {
    const timestamp = Date.now();
    const organizationData = {
      name: `Test Organization ${timestamp}`,
      email: `test.org.${timestamp}@example.com`,
      password: 'testpassword123',
      phone: '+1-555-123-4567',
      address: '123 Test Street',
      city: 'Test City',
      state: 'TS',
      country: 'US',
      postalCode: '12345',
      website: 'https://test-org.com'
    };

    const testData = JSON.stringify(organizationData);
    const url = new URL(`${baseUrl}/api/organization`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      timeout: 30000
    };

    console.log(colorize('🏢 Testing Organization Signup with GHL Integration...', 'yellow'));
    console.log(`   URL: ${url.href}`);
    console.log(`   Organization Name: ${organizationData.name}`);
    console.log(`   Organization Email: ${organizationData.email}`);
    console.log();

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 201 && response.message) {
            console.log(colorize('✅ ORGANIZATION SIGNUP SUCCESSFUL!', 'green'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Organization ID: ${response.organization?.id || 'N/A'}`);
            console.log(`   Message: ${response.message}`);
            
            // Check GHL integration
            if (response.ghlLocationId) {
              console.log(colorize('\n🔗 GHL Integration Status:', 'cyan'));
              console.log(`   ✅ GHL Location ID: ${response.ghlLocationId}`);
              
              if (response.ghlApiKey) {
                console.log(`   ✅ GHL Sub-Account API Key: ${response.ghlApiKey.substring(0, 20)}...`);
                console.log(`   ✅ API Key stored in Organization table`);
              } else {
                console.log(`   ❌ GHL Sub-Account API Key: NOT FOUND`);
              }
              
              if (response.organization?.ghlId) {
                console.log(`   ✅ Organization GHL ID: ${response.organization.ghlId}`);
                console.log(`   ✅ Organization updated with GHL data`);
              } else {
                console.log(`   ❌ Organization GHL ID: NOT SET`);
              }
              
              if (response.ghlAccount) {
                console.log(`   ✅ GHL Account record created`);
                console.log(`   ✅ Business Name: ${response.ghlAccount.business_name || 'N/A'}`);
                console.log(`   ✅ Status: ${response.ghlAccount.status || 'N/A'}`);
              } else {
                console.log(`   ❌ GHL Account record: NOT CREATED`);
              }
            } else {
              console.log(colorize('\n❌ GHL Integration Status:', 'red'));
              console.log(`   ❌ GHL Location ID: NOT FOUND`);
              console.log(`   ❌ GHL integration failed`);
            }
            
            resolve({ success: true, data: response });
          } else {
            console.log(colorize('❌ ORGANIZATION SIGNUP FAILED!', 'red'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Error: ${response.error || 'Unknown error'}`);
            console.log(`   Details: ${JSON.stringify(response, null, 2)}`);
            resolve({ success: false, error: response.error || 'Unknown error', details: response });
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

    req.write(testData);
    req.end();
  });
}

async function main() {
  const baseUrl = process.argv[2] || 'https://app.changeworksfund.org';
  
  console.log(colorize('🏢 Organization Signup with GHL Integration Test', 'cyan'));
  console.log(colorize('===============================================', 'cyan'));
  console.log(`   Base URL: ${baseUrl}`);
  console.log();

  try {
    const result = await testOrganizationSignup(baseUrl);
    
    console.log(colorize('\n📊 Final Results:', 'cyan'));
    if (result.success) {
      console.log(colorize('🎉 Test completed successfully!', 'green'));
      console.log('   ✅ Organization account created');
      console.log(`   ${result.data.ghlLocationId ? '✅' : '❌'} GHL sub-account ${result.data.ghlLocationId ? 'created' : 'not created'}`);
      console.log(`   ${result.data.ghlApiKey ? '✅' : '❌'} Sub-account API key ${result.data.ghlApiKey ? 'stored' : 'not stored'}`);
      console.log(`   ${result.data.ghlAccount ? '✅' : '❌'} GHL account record ${result.data.ghlAccount ? 'saved' : 'not saved'}`);
      
      if (result.data.ghlLocationId && result.data.ghlApiKey) {
        console.log(colorize('\n💡 Next Steps:', 'cyan'));
        console.log('   • API key is now stored in Organization table');
        console.log('   • Donor signup will use Organization.ghlApiKey');
        console.log('   • No need for GHLAccount table lookup');
        console.log('   • Direct access to GHL credentials');
        console.log(`   • Location ID: ${result.data.ghlLocationId}`);
        console.log(`   • API Key: ${result.data.ghlApiKey.substring(0, 20)}...`);
      }
    } else {
      console.log(colorize('❌ Test failed!', 'red'));
      console.log(`   Error: ${result.error}`);
    }
  } catch (error) {
    console.log(colorize('❌ Test error:', 'red'));
    console.log(`   ${error.message}`);
  }
}

main().catch(console.error);
