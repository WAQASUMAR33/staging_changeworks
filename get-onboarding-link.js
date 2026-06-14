/**
 * Script to retrieve Stripe onboarding link for an organization
 * Usage: node get-onboarding-link.js <email> or node get-onboarding-link.js <organizationId>
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

async function getOnboardingLink(identifier) {
  // Check if identifier is a number (organization ID) or email
  const isId = !isNaN(parseInt(identifier));
  const param = isId ? `organizationId=${identifier}` : `email=${identifier}`;
  
  console.log(`🔍 Retrieving onboarding link for: ${identifier}`);
  console.log('');

  try {
    const response = await fetch(`${API_BASE_URL}/api/organization/resend-onboarding-email?${param}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('❌ Failed to retrieve onboarding link');
      console.error(`   Error: ${data.error || 'Unknown error'}`);
      if (data.details) {
        console.error(`   Details: ${data.details}`);
      }
      return;
    }

    console.log('✅ Onboarding Link Retrieved Successfully!');
    console.log('');
    console.log('📋 Organization Details:');
    console.log(`   ID: ${data.organization.id}`);
    console.log(`   Name: ${data.organization.name}`);
    console.log(`   Email: ${data.organization.email}`);
    console.log('');
    console.log('🔗 Stripe Onboarding Link:');
    console.log('===========================');
    console.log(data.onboardingLink);
    console.log('');
    console.log('⏰ Link Expires:');
    console.log(`   ${new Date(data.expiresAt).toLocaleString()}`);
    console.log('');
    console.log('📝 Next Steps:');
    console.log('   1. Copy the onboarding link above');
    console.log('   2. Open it in your browser');
    console.log('   3. Complete the Stripe account setup');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Get identifier from command line argument
const identifier = process.argv[2];

if (!identifier) {
  console.error('❌ Please provide an email address or organization ID');
  console.error('');
  console.error('Usage:');
  console.error('  node get-onboarding-link.js <email>');
  console.error('  node get-onboarding-link.js <organizationId>');
  console.error('');
  console.error('Examples:');
  console.error('  node get-onboarding-link.js theitxprts@gmail.com');
  console.error('  node get-onboarding-link.js 27');
  process.exit(1);
}

getOnboardingLink(identifier)
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Failed:', error);
    process.exit(1);
  });
