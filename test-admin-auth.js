const http = require('http');

// Test admin authentication flow
async function testAdminAuth() {
  console.log('🔍 Testing Admin Authentication Flow');
  
  // Test 1: Check if admin login endpoint exists
  console.log('\n1. Testing admin login endpoint...');
  
  const loginData = JSON.stringify({
    email: 'superadmin@changeworksfund.org', // Using existing super admin
    password: 'admin123' // Default password
  });
  
  const loginOptions = {
    hostname: 'localhost',
    port: 3000,
    path: '/api/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  };
  
  try {
    const loginResponse = await makeRequest(loginOptions, loginData);
    console.log('Login Response:', loginResponse);
    
    if (loginResponse.token) {
      console.log('✅ Login successful, token received');
      
      // Test 2: Check admin dashboard stats with token
      console.log('\n2. Testing admin dashboard stats with token...');
      
      const statsOptions = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/admin/dashboard-stats',
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${loginResponse.token}`
        }
      };
      
      const statsResponse = await makeRequest(statsOptions);
      console.log('Dashboard Stats Response:', statsResponse);
      
      if (statsResponse.success) {
        console.log('✅ Admin dashboard stats accessible');
      } else {
        console.log('❌ Admin dashboard stats failed:', statsResponse.error);
      }
    } else {
      console.log('❌ Login failed');
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeRequest(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve(parsed);
        } catch (error) {
          resolve({ error: 'Invalid JSON response', raw: responseData });
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    if (data) {
      req.write(data);
    }
    
    req.end();
  });
}

// Run the test
testAdminAuth().catch(console.error);
