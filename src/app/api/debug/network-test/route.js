import { NextResponse } from "next/server";

export async function GET() {
  const tests = [];
  
  try {
    // Test 1: Basic connectivity to Plaid
    console.log('Testing connectivity to Plaid API...');
    const startTime = Date.now();
    
    const response = await fetch('https://sandbox.plaid.com/link/token/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID || 'test',
        'PLAID-SECRET': process.env.PLAID_SECRET_KEY || 'test',
      },
      body: JSON.stringify({
        client_id: process.env.PLAID_CLIENT_ID || 'test',
        secret: process.env.PLAID_SECRET_KEY || 'test',
        client_name: 'Network Test',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
        user: {
          client_user_id: 'test-user',
        },
      }),
      signal: AbortSignal.timeout(10000), // 10 second timeout for test
    });
    
    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    tests.push({
      name: 'Plaid API Connectivity',
      status: response.ok ? 'SUCCESS' : 'FAILED',
      responseTime: `${responseTime}ms`,
      statusCode: response.status,
      details: response.ok ? 'Successfully connected to Plaid API' : `HTTP ${response.status}`
    });
    
  } catch (error) {
    tests.push({
      name: 'Plaid API Connectivity',
      status: 'FAILED',
      error: error.message,
      errorCode: error.code,
      details: 'Network connection failed'
    });
  }
  
  // Test 2: DNS Resolution
  try {
    const dnsStart = Date.now();
    const dnsResponse = await fetch('https://sandbox.plaid.com', {
      method: 'HEAD',
      signal: AbortSignal.timeout(5000),
    });
    const dnsEnd = Date.now();
    
    tests.push({
      name: 'DNS Resolution',
      status: 'SUCCESS',
      responseTime: `${dnsEnd - dnsStart}ms`,
      details: 'DNS resolution successful'
    });
  } catch (error) {
    tests.push({
      name: 'DNS Resolution',
      status: 'FAILED',
      error: error.message,
      details: 'DNS resolution failed'
    });
  }
  
  // Test 3: Environment Variables
  tests.push({
    name: 'Environment Variables',
    status: process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET_KEY ? 'SUCCESS' : 'FAILED',
    details: {
      PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID ? 'Set' : 'Missing',
      PLAID_SECRET_KEY: process.env.PLAID_SECRET_KEY ? 'Set' : 'Missing',
      NEXT_PUBLIC_PLAID_ENV: process.env.NEXT_PUBLIC_PLAID_ENV || 'Not set'
    }
  });
  
  // Test 4: Basic HTTPS connectivity
  try {
    const httpsStart = Date.now();
    const httpsResponse = await fetch('https://httpbin.org/get', {
      signal: AbortSignal.timeout(5000),
    });
    const httpsEnd = Date.now();
    
    tests.push({
      name: 'HTTPS Connectivity',
      status: httpsResponse.ok ? 'SUCCESS' : 'FAILED',
      responseTime: `${httpsEnd - httpsStart}ms`,
      details: 'Basic HTTPS connectivity test'
    });
  } catch (error) {
    tests.push({
      name: 'HTTPS Connectivity',
      status: 'FAILED',
      error: error.message,
      details: 'HTTPS connectivity failed - possible firewall/proxy issue'
    });
  }
  
  return NextResponse.json({
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    tests: tests,
    summary: {
      total: tests.length,
      passed: tests.filter(t => t.status === 'SUCCESS').length,
      failed: tests.filter(t => t.status === 'FAILED').length
    },
    recommendations: generateRecommendations(tests)
  });
}

function generateRecommendations(tests) {
  const recommendations = [];
  
  const failedTests = tests.filter(t => t.status === 'FAILED');
  
  if (failedTests.some(t => t.name === 'Plaid API Connectivity' && t.errorCode === 'UND_ERR_CONNECT_TIMEOUT')) {
    recommendations.push({
      issue: 'Network Timeout',
      solutions: [
        'Check if your server is behind a firewall that blocks outbound HTTPS connections',
        'Verify your hosting provider allows outbound connections to external APIs',
        'Try using a different network or server environment',
        'Contact your hosting provider about network restrictions'
      ]
    });
  }
  
  if (failedTests.some(t => t.name === 'DNS Resolution')) {
    recommendations.push({
      issue: 'DNS Resolution',
      solutions: [
        'Check your DNS configuration',
        'Try using a different DNS server (8.8.8.8, 1.1.1.1)',
        'Verify your server can resolve external domains'
      ]
    });
  }
  
  if (failedTests.some(t => t.name === 'Environment Variables')) {
    recommendations.push({
      issue: 'Missing Environment Variables',
      solutions: [
        'Add PLAID_CLIENT_ID to your .env file',
        'Add PLAID_SECRET_KEY to your .env file',
        'Restart your development server after adding environment variables'
      ]
    });
  }
  
  if (failedTests.some(t => t.name === 'HTTPS Connectivity')) {
    recommendations.push({
      issue: 'HTTPS Connectivity',
      solutions: [
        'Check if your server can make outbound HTTPS requests',
        'Verify there are no proxy settings blocking external connections',
        'Test with a different external API to confirm general connectivity'
      ]
    });
  }
  
  if (recommendations.length === 0) {
    recommendations.push({
      issue: 'All tests passed',
      solutions: [
        'Network connectivity appears to be working',
        'The issue might be intermittent - try the Plaid integration again',
        'Check Plaid\'s status page for any service outages'
      ]
    });
  }
  
  return recommendations;
}
