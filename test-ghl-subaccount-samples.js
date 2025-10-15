const https = require('https');
const fs = require('fs');

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

function testSubAccountCreation(apiKey, sampleFile) {
  return new Promise((resolve, reject) => {
    console.log(colorize(`\n🔍 Testing with ${sampleFile}...`, 'cyan'));
    
    try {
      // Read the sample file
      const sampleData = JSON.parse(fs.readFileSync(sampleFile, 'utf8'));
      
      // Add timestamp to make it unique
      const timestamp = Date.now();
      sampleData.name = `${sampleData.name} ${timestamp}`;
      if (sampleData.prospectInfo && sampleData.prospectInfo.email) {
        sampleData.prospectInfo.email = sampleData.prospectInfo.email.replace('@', `+${timestamp}@`);
      }
      
      const testData = JSON.stringify(sampleData);

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
          'Version': '2021-07-28'
        },
        timeout: 30000
      };

      console.log(colorize('🚀 Creating GHL Sub-Account...', 'yellow'));
      console.log(`   Endpoint: ${subAccountApiUrl}`);
      console.log(`   Key: ${apiKey.substring(0, 20)}...`);
      console.log(`   Sample: ${sampleFile}`);
      console.log(`   Account Name: ${sampleData.name}`);
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
              console.log(colorize('✅ SUB-ACCOUNT CREATED SUCCESSFULLY!', 'green'));
              console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
              console.log(`   Location ID: ${response.id || 'N/A'}`);
              console.log(`   Account Name: ${response.name || 'N/A'}`);
              console.log(`   Email: ${response.prospectInfo?.email || 'N/A'}`);
              console.log(`   Response: ${JSON.stringify(response, null, 2)}`);
              resolve({ success: true, data: response });
            } else {
              console.log(colorize('❌ FAILED!', 'red'));
              console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
              console.log(`   Error: ${response.msg || 'Unknown error'}`);
              console.log(`   Details: ${JSON.stringify(response, null, 2)}`);
              resolve({ success: false, error: response });
            }
          } catch (parseError) {
            console.log(colorize('❌ FAILED!', 'red'));
            console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
            console.log(`   Parse Error: ${parseError.message}`);
            console.log(`   Raw Response: ${data}`);
            resolve({ success: false, error: { msg: 'Parse error', details: data } });
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

    } catch (error) {
      console.log(colorize('❌ FILE ERROR!', 'red'));
      console.log(`   Error reading ${sampleFile}: ${error.message}`);
      reject(error);
    }
  });
}

async function main() {
  const apiKey = process.argv[2];
  
  if (!apiKey) {
    console.log(colorize('❌ Usage: node test-ghl-subaccount-samples.js <API_KEY>', 'red'));
    console.log(colorize('   Example: node test-ghl-subaccount-samples.js "your-api-key-here"', 'yellow'));
    process.exit(1);
  }

  console.log(colorize('🔑 GHL Sub-Account Creation Test with Samples', 'cyan'));
  console.log(colorize('=============================================', 'cyan'));

  const sampleFiles = [
    'ghl-subaccount-minimal.json',
    'ghl-subaccount-sample.json',
    'ghl-subaccount-detailed.json'
  ];

  let successCount = 0;
  let totalCount = sampleFiles.length;

  for (const sampleFile of sampleFiles) {
    if (fs.existsSync(sampleFile)) {
      try {
        const result = await testSubAccountCreation(apiKey, sampleFile);
        if (result.success) {
          successCount++;
        }
      } catch (error) {
        console.log(colorize(`❌ Error testing ${sampleFile}: ${error.message}`, 'red'));
      }
    } else {
      console.log(colorize(`⚠️  Sample file not found: ${sampleFile}`, 'yellow'));
    }
  }

  console.log(colorize('\n📊 Final Results:', 'cyan'));
  console.log(`   Successful: ${successCount}/${totalCount}`);
  console.log(`   Failed: ${totalCount - successCount}/${totalCount}`);
  
  if (successCount === totalCount) {
    console.log(colorize('🎉 All tests passed!', 'green'));
  } else if (successCount > 0) {
    console.log(colorize('⚠️  Some tests passed', 'yellow'));
  } else {
    console.log(colorize('❌ All tests failed', 'red'));
  }
}

main().catch(console.error);
