/**
 * Test script for Organization Signup API with Stripe Account Creation
 * Tests the signup flow with email: theitxprts@gmail.com
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function testOrganizationSignup() {
  const testEmail = 'theitxprts@gmail.com';
  const timestamp = Date.now();
  
  const signupData = {
    // Basic Information (Step 1)
    name: `Test Organization ${timestamp}`,
    email: testEmail,
    phone: '+1234567890',
    company: `Test Company ${timestamp}`,
    website: 'https://test-org.com',
    
    // Address Information (Step 2)
    address: '123 Test Street',
    city: 'New York',
    state: 'NY',
    country: 'US',
    postalCode: '10001',
    
    // Stripe Connect Account (Step 3)
    createStripeAccount: true,
    
    // Organization Login (Step 4)
    orgPassword: 'TestPassword123!',
    confirmOrgPassword: 'TestPassword123!'
  };

  console.log('🧪 Testing Organization Signup API');
  console.log('=====================================');
  console.log(`Email: ${testEmail}`);
  console.log(`API URL: ${API_BASE_URL}/api/organization`);
  console.log('');

  try {
    console.log('📤 Sending signup request...');
    const response = await fetch(`${API_BASE_URL}/api/organization`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(signupData)
    });

    const responseData = await response.json();
    
    console.log(`📥 Response Status: ${response.status}`);
    console.log('');

    if (!response.ok) {
      console.error('❌ Signup Failed!');
      console.error('Error:', responseData);
      return;
    }

    console.log('✅ Signup Successful!');
    console.log('');
    console.log('📊 Response Details:');
    console.log('====================');
    console.log(`Organization ID: ${responseData.organization?.id || 'N/A'}`);
    console.log(`Organization Name: ${responseData.organization?.name || 'N/A'}`);
    console.log(`Organization Email: ${responseData.organization?.email || 'N/A'}`);
    console.log('');

    // Check Stripe Account Creation
    console.log('💳 Stripe Account Information:');
    console.log('==============================');
    if (responseData.stripeAccount) {
      console.log(`✅ Stripe Account Created: ${responseData.stripeAccount.id}`);
      console.log(`   Account Type: ${responseData.stripeAccount.type}`);
      console.log(`   Onboarding URL: ${responseData.stripeAccount.onboardingUrl || 'N/A'}`);
      console.log(`   Onboarding Link Expires: ${responseData.stripeAccount.onboardingLinkExpiresAt || 'N/A'}`);
    } else {
      console.log('❌ No Stripe account created');
    }
    console.log('');

    // Check Onboarding Link
    console.log('🔗 Onboarding Link:');
    console.log('===================');
    if (responseData.stripeOnboardingLink) {
      console.log(`✅ Onboarding Link Generated:`);
      console.log(`   ${responseData.stripeOnboardingLink}`);
    } else {
      console.log('❌ No onboarding link generated');
    }
    console.log('');

    // Check Email Status
    console.log('📧 Email Status:');
    console.log('===============');
    if (responseData.emailSent) {
      console.log(`✅ Email Status: ${responseData.emailSent}`);
      if (responseData.emailSent === 'sent') {
        console.log(`   Email should be sent to: ${testEmail}`);
        console.log('   Please check your inbox (and spam folder)');
      } else if (responseData.emailSent.includes('failed')) {
        console.log(`   ⚠️ Email sending failed: ${responseData.emailSent}`);
      } else if (responseData.emailSent.includes('skipped')) {
        console.log(`   ⚠️ Email sending skipped: ${responseData.emailSent}`);
      }
    } else {
      console.log('❌ No email status information');
    }
    console.log('');

    // Check GHL Account
    if (responseData.ghlLocationId) {
      console.log('🔵 GHL Account:');
      console.log('===============');
      console.log(`✅ GHL Location ID: ${responseData.ghlLocationId}`);
      console.log('');
    }

    // Summary
    console.log('📋 Summary:');
    console.log('===========');
    console.log(`✅ Organization Created: ${responseData.organization ? 'Yes' : 'No'}`);
    console.log(`✅ Stripe Account Created: ${responseData.stripeAccount ? 'Yes' : 'No'}`);
    console.log(`✅ Onboarding Link Generated: ${responseData.stripeOnboardingLink ? 'Yes' : 'No'}`);
    console.log(`✅ Email Sent: ${responseData.emailSent === 'sent' ? 'Yes' : 'No'}`);
    console.log('');

    if (responseData.stripeOnboardingLink) {
      console.log('🎯 Next Steps:');
      console.log('==============');
      console.log(`1. Check email inbox for: ${testEmail}`);
      console.log(`2. Or use this onboarding link directly:`);
      console.log(`   ${responseData.stripeOnboardingLink}`);
      console.log('3. Complete Stripe account onboarding');
      console.log('');
    }

  } catch (error) {
    console.error('❌ Test Failed with Error:');
    console.error('==========================');
    console.error(error.message);
    console.error('');
    console.error('Stack trace:');
    console.error(error.stack);
  }
}

// Run the test
console.log('🚀 Starting Organization Signup Test');
console.log('');
testOrganizationSignup()
  .then(() => {
    console.log('✅ Test completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
