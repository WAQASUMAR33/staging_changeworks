import { NextResponse } from "next/server";
import { createStripeAccountDirect, createStripeAccountLinkDirect } from "../../lib/stripe-direct-api";
import emailService from "../../lib/email-service";
import { corsHeaders } from '@/app/lib/cors';

// POST endpoint to test Stripe account creation and onboarding link
export async function POST(request) {
  try {
    const body = await request.json();
    const { country, testEmail } = body;

    // Validate input
    if (!country) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Country is required',
          instructions: 'Provide a 2-letter country code (e.g., "US", "GB", "CA")'
        },
        { status: 400 }
      );
    }

    // Check if Stripe is configured
    const { getStripeSecretKey, getPaymentMode } = await import('@/app/lib/payment-mode');
    const stripeSecretKey = await getStripeSecretKey();
    if (!stripeSecretKey) {
      return NextResponse.json(
        { success: false, error: 'Stripe not configured', details: 'No Stripe secret key set for current payment mode' },
        { status: 503 }
      );
    }

    console.log('=== STRIPE ACCOUNT TEST ===');
    console.log('Country:', country);
    console.log('Stripe Key:', stripeSecretKey ? `${stripeSecretKey.substring(0, 20)}...` : 'NOT SET');
    console.log('Key Type:', stripeSecretKey?.startsWith('sk_test_') ? 'TEST MODE' : stripeSecretKey?.startsWith('sk_live_') ? 'LIVE MODE' : 'UNKNOWN');

    // Step 1: Create Stripe account
    console.log('\n--- Step 1: Creating Stripe Express Account ---');
    const accountResult = await createStripeAccountDirect(country);

    if (!accountResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create Stripe account',
          details: accountResult.error || 'Unknown error'
        },
        { status: 500 }
      );
    }

    const stripeAccount = accountResult.account;
    console.log('✅ Stripe Account Created:', stripeAccount.id);
    console.log('   Type:', stripeAccount.type);
    console.log('   Country:', stripeAccount.country);
    console.log('   Charges Enabled:', stripeAccount.charges_enabled);
    console.log('   Payouts Enabled:', stripeAccount.payouts_enabled);

    // Step 2: Create onboarding link
    console.log('\n--- Step 2: Creating Onboarding Link ---');
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const refreshUrl = `${baseUrl}/organization/dashboard/stripe-products`;
    const returnUrl = `${baseUrl}/organization/dashboard/stripe-products`;

    const linkResult = await createStripeAccountLinkDirect(
      stripeAccount.id,
      refreshUrl,
      returnUrl
    );

    if (!linkResult.success) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create onboarding link',
          details: linkResult.error || 'Unknown error',
          accountCreated: true,
          accountId: stripeAccount.id
        },
        { status: 500 }
      );
    }

    const accountLink = linkResult.accountLink;
    console.log('✅ Onboarding Link Created');
    console.log('   URL:', accountLink.url);
    console.log('   Expires At:', new Date(accountLink.expires_at * 1000).toISOString());

    // Step 3: Send test email (if email provided)
    let emailResult = null;
    if (testEmail) {
      console.log('\n--- Step 3: Sending Test Email ---');
      try {
        emailResult = await emailService.sendStripeOnboardingEmail({
        organization: {
          name: 'Test Organization',
          email: testEmail,
          imageUrl: '/imgs/changeworks.png'
        },
        onboardingUrl: accountLink.url
      });

        if (emailResult.success) {
          console.log('✅ Test email sent successfully to:', testEmail);
        } else {
          console.error('❌ Failed to send test email:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Email sending error:', emailError.message);
        emailResult = {
          success: false,
          error: emailError.message
        };
      }
    } else {
      console.log('\n--- Step 3: Skipping Email (no testEmail provided) ---');
    }

    // Return success response
    return NextResponse.json({
      success: true,
      message: 'Stripe account and onboarding link created successfully',
      account: {
        id: stripeAccount.id,
        type: stripeAccount.type,
        country: stripeAccount.country,
        charges_enabled: stripeAccount.charges_enabled,
        payouts_enabled: stripeAccount.payouts_enabled,
        details_submitted: stripeAccount.details_submitted
      },
      onboardingLink: {
        url: accountLink.url,
        expires_at: accountLink.expires_at,
        expires_at_formatted: new Date(accountLink.expires_at * 1000).toISOString()
      },
      email: emailResult ? {
        sent: emailResult.success,
        recipient: testEmail,
        error: emailResult.error || null
      } : {
        sent: false,
        message: 'No email sent (testEmail not provided)'
      },
      nextSteps: [
        '1. Copy the onboarding URL above',
        '2. Open it in a browser to test the Stripe onboarding flow',
        '3. Complete the onboarding process',
        '4. Check your Stripe Dashboard to verify the account status'
      ]
    }, { status: 200 });

  } catch (error) {
    console.error('❌ Stripe Account Test Error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Test failed',
        message: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}

// GET endpoint to show test instructions
export async function GET() {
  const { getStripeSecretKey, getPaymentMode } = await import('@/app/lib/payment-mode');
  const [stripeSecretKey, mode] = await Promise.all([getStripeSecretKey(), getPaymentMode()]);
  const stripeConfigured = !!stripeSecretKey;
  const emailConfigured = !!(
    process.env.EMAIL_SERVER_HOST &&
    process.env.EMAIL_SERVER_USER &&
    process.env.EMAIL_SERVER_PASSWORD
  );

  return NextResponse.json({
    message: "Stripe Account Creation Test Endpoint",
    configuration: {
      stripe: {
        configured: stripeConfigured,
        mode,
        keyType: stripeSecretKey?.startsWith('sk_test_') ? 'TEST MODE' :
                 stripeSecretKey?.startsWith('sk_live_') ? 'LIVE MODE' :
                 'NOT SET',
        keyLength: stripeSecretKey?.length || 0
      },
      email: {
        configured: emailConfigured,
        host: process.env.EMAIL_SERVER_HOST ? 'Set' : 'Missing',
        user: process.env.EMAIL_SERVER_USER ? 'Set' : 'Missing'
      }
    },
    instructions: {
      method: "POST",
      endpoint: "/api/test-stripe-account",
      body: {
        country: "US",
        testEmail: "your-email@example.com"
      },
      description: "Creates a Stripe Express account and generates an onboarding link. Optionally sends a test email."
    },
    example: {
      curl: `curl -X POST http://localhost:3000/api/test-stripe-account \\
  -H "Content-Type: application/json" \\
  -d '{"country": "US", "testEmail": "test@example.com"}'`,
      javascript: `fetch('/api/test-stripe-account', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    country: 'US',
    testEmail: 'test@example.com'
  })
})
.then(res => res.json())
.then(data => console.log(data));`
    },
    supportedCountries: [
      "US", "GB", "CA", "AU", "DE", "FR", "IT", "ES", "NL", "BE", "AT", "IE",
      "SE", "NO", "DK", "FI", "PL", "PT", "CH", "NZ", "SG", "HK", "JP"
    ]
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
