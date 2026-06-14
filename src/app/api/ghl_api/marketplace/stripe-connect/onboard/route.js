import { corsHeaders } from '@/app/lib/cors';


/**
 * Stripe Connect Onboarding - Initiate
 *
 * POST body: { locationId, email, businessName }
 *
 * Creates (or retrieves) a Stripe Connect Express account for the given GHL
 * location and returns an onboarding URL that you redirect the user to.
 */
export async function POST(req) {
  let body;
  try {
    const stripe = await createStripeClient();
    body = await req.json();
  } catch {
    return Response.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { locationId, email, businessName } = body;

  if (!locationId) {
    return Response.json(
      { success: false, message: 'locationId is required' },
      { status: 400 }
    );
  }

  try {
    const stripe = await createStripeClient();
    // TODO: check if a Stripe account already exists for this locationId in your DB
    let stripeAccountId = await getExistingStripeAccount(locationId);

    if (!stripeAccountId) {
      // Create a new Stripe Connect Express account
      const account = await stripe.accounts.create({
        type: 'express',
        email: email || undefined,
        business_profile: {
          name: businessName || undefined,
        },
        metadata: { ghlLocationId: locationId },
        capabilities: {
          card_payments:                { requested: true },
          transfers:                    { requested: true },
          us_bank_account_ach_payments: { requested: true },
        },
      });

      stripeAccountId = account.id;

      // TODO: persist stripeAccountId → locationId mapping in your DB
      console.log('Stripe Connect account created', { stripeAccountId, locationId });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/api/ghl_api/marketplace/stripe-connect/onboard?locationId=${locationId}&retry=true`,
      return_url: `${baseUrl}/api/ghl_api/marketplace/stripe-connect/callback?locationId=${locationId}&stripeAccountId=${stripeAccountId}`,
      type: 'account_onboarding',
    });

    return Response.json({
      success: true,
      data: {
        stripeAccountId,
        onboardingUrl: accountLink.url,
        expiresAt: accountLink.expires_at,
      },
    });
  } catch (error) {
    console.error('Stripe Connect onboard error', { locationId, message: error.message });
    return Response.json(
      { success: false, message: 'Failed to create Stripe onboarding link', error: error.message },
      { status: 500 }
    );
  }
}

// Retry link when the user refreshes / times out before completing onboarding
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('locationId');
  const retry = searchParams.get('retry');

  if (!locationId || !retry) {
    return Response.json(
      { success: false, message: 'locationId and retry params are required' },
      { status: 400 }
    );
  }

  // Delegate back to POST handler
  return POST(
    new Request(req.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locationId }),
    })
  );
}

// ---------------------------------------------------------------------------
// Helper – replace with a real DB lookup
// ---------------------------------------------------------------------------
async function getExistingStripeAccount(locationId) {
  // TODO: e.g. const record = await db.stripeConnections.findOne({ locationId });
  // return record?.stripeAccountId ?? null;
  return null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
