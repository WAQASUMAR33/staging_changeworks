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

function decodeJWT(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { error: 'Invalid JWT format' };
    }
    
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    return { header, payload };
  } catch (error) {
    return { error: error.message };
  }
}

function testTokenType(token, tokenName) {
  return new Promise((resolve) => {
    console.log(colorize(`\n🔍 Testing ${tokenName}...`, 'cyan'));
    console.log(`   Token: ${token.substring(0, 20)}...`);
    
    // Decode JWT to see what type it is
    const decoded = decodeJWT(token);
    if (decoded.error) {
      console.log(colorize(`   ❌ JWT Decode Error: ${decoded.error}`, 'red'));
      resolve({ success: false, error: decoded.error });
      return;
    }
    
    console.log(`   Header:`, JSON.stringify(decoded.header, null, 2));
    console.log(`   Payload:`, JSON.stringify(decoded.payload, null, 2));
    
    // Check if it's a location token or agency token
    if (decoded.payload.location_id) {
      console.log(colorize(`   ✅ This is a LOCATION TOKEN`, 'green'));
      console.log(`   Location ID: ${decoded.payload.location_id}`);
    } else if (decoded.payload.company_id) {
      console.log(colorize(`   ✅ This is an AGENCY TOKEN`, 'green'));
      console.log(`   Company ID: ${decoded.payload.company_id}`);
    } else {
      console.log(colorize(`   ⚠️ Unknown token type`, 'yellow'));
    }
    
    // Test with location token endpoint
    const tokenData = JSON.stringify({
      locationId: decoded.payload.location_id || 'test-location-id'
    });
    
    const options = {
      hostname: 'services.leadconnectorhq.com',
      port: 443,
      path: '/oauth/locationToken',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      },
      timeout: 30000
    };

    console.log(`   Testing with location token endpoint...`);

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const response = JSON.parse(data);
          
          if (res.statusCode === 200) {
            console.log(colorize(`   ✅ ${tokenName} works with location token endpoint!`, 'green'));
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Response: ${JSON.stringify(response, null, 2)}`);
            resolve({ success: true, data: response });
          } else {
            console.log(colorize(`   ❌ ${tokenName} failed with location token endpoint`, 'red'));
            console.log(`   Status: ${res.statusCode}`);
            console.log(`   Error: ${response.message || 'Unknown error'}`);
            resolve({ success: false, error: response.message || 'Unknown error' });
          }
        } catch (parseError) {
          console.log(colorize(`   ❌ Parse error: ${parseError.message}`, 'red'));
          console.log(`   Raw response: ${data}`);
          resolve({ success: false, error: 'Parse error' });
        }
      });
    });

    req.on('error', (error) => {
      console.log(colorize(`   ❌ Network error: ${error.message}`, 'red'));
      resolve({ success: false, error: error.message });
    });

    req.on('timeout', () => {
      console.log(colorize(`   ❌ Timeout error`, 'red'));
      req.destroy();
      resolve({ success: false, error: 'Timeout' });
    });

    req.write(tokenData);
    req.end();
  });
}

async function main() {
  const token = process.argv[2];
  
  if (!token) {
    console.log(colorize('❌ Usage: node test-token-types.js <TOKEN>', 'red'));
    console.log(colorize('   Example: node test-token-types.js "eyJhbGciOiJIUzI1NiIs..."', 'yellow'));
    process.exit(1);
  }

  console.log(colorize('🔑 GHL Token Type Analysis', 'cyan'));
  console.log(colorize('==========================', 'cyan'));

  const result = await testTokenType(token, 'Provided Token');
  
  console.log(colorize('\n📊 Analysis Results:', 'cyan'));
  if (result.success) {
    console.log(colorize('✅ Token is valid and can generate location tokens', 'green'));
  } else {
    console.log(colorize('❌ Token is invalid or cannot generate location tokens', 'red'));
    console.log(`   Error: ${result.error}`);
  }
  
  console.log(colorize('\n💡 Recommendations:', 'cyan'));
  console.log('   • Agency tokens should have company_id in payload');
  console.log('   • Location tokens should have location_id in payload');
  console.log('   • Agency tokens can create sub-accounts and generate location tokens');
  console.log('   • Location tokens can only access their specific location');
}

main().catch(console.error);
