/**
 * Test script to check email configuration and test email sending
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function checkEmailConfig() {
  console.log('🔍 Checking Email Configuration');
  console.log('================================');
  console.log('');

  try {
    const response = await fetch(`${API_BASE_URL}/api/email/test-email`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();
    
    console.log('📊 Email Configuration Status:');
    console.log('==============================');
    console.log(`Configured: ${data.emailConfig?.configured ? '✅ Yes' : '❌ No'}`);
    console.log('');
    
    if (data.emailConfig) {
      console.log('📧 Configuration Details:');
      console.log(`   Host: ${data.emailConfig.host}`);
      console.log(`   Port: ${data.emailConfig.port}`);
      console.log(`   User: ${data.emailConfig.user}`);
      console.log(`   Password: ${data.emailConfig.password}`);
      console.log(`   From: ${data.emailConfig.from}`);
      console.log('');
    }

    if (data.connectionTest) {
      console.log('🔌 Connection Test:');
      console.log(`   Status: ${data.connectionTest.success ? '✅ Success' : '❌ Failed'}`);
      if (data.connectionTest.error) {
        console.log(`   Error: ${data.connectionTest.error}`);
      }
      console.log('');
    }

    if (!data.emailConfig?.configured) {
      console.log('⚠️  Email is not configured!');
      console.log('');
      console.log('Please set the following environment variables:');
      console.log('  - EMAIL_SERVER_HOST');
      console.log('  - EMAIL_SERVER_PORT');
      console.log('  - EMAIL_SERVER_USER');
      console.log('  - EMAIL_SERVER_PASSWORD');
      console.log('  - EMAIL_FROM');
      console.log('');
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error checking email configuration:', error.message);
    return false;
  }
}

async function testEmailSending(toEmail) {
  console.log('📧 Testing Email Sending');
  console.log('=========================');
  console.log(`To: ${toEmail}`);
  console.log('');

  try {
    const response = await fetch(`${API_BASE_URL}/api/email/test-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: toEmail,
        subject: 'Test Email - Stripe Onboarding Link Test',
        message: 'This is a test email to verify email configuration is working correctly.'
      })
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ Email sent successfully!');
      console.log(`   Message ID: ${data.messageId}`);
      console.log('');
      console.log('📬 Please check your inbox (and spam folder) for the test email.');
      return true;
    } else {
      console.error('❌ Failed to send email');
      console.error(`   Error: ${data.error}`);
      if (data.details) {
        console.error(`   Details: ${JSON.stringify(data.details, null, 2)}`);
      }
      return false;
    }
  } catch (error) {
    console.error('❌ Error sending test email:', error.message);
    return false;
  }
}

async function main() {
  const testEmail = process.argv[2] || 'theitxprts@gmail.com';
  
  console.log('🚀 Email Configuration Test');
  console.log('');
  
  const isConfigured = await checkEmailConfig();
  
  if (isConfigured) {
    console.log('');
    await testEmailSending(testEmail);
  }
  
  console.log('');
  console.log('✅ Test completed');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
