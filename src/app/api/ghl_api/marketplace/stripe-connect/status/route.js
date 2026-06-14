import { corsHeaders } from '@/app/lib/cors';


/**
 * Stripe Connect Status Check
 *
 * GET ?locationId=<ghlLocationId>
 *
 * Returns the current Stripe Connect account status for a GHL location so
 * the UI can show "Connected", "Incomplete", or "Not connected".
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('locationId');

  if (!locationId) {
    return Response.json(
      { success: false, message: 'locationId is required' },
      { status: 400 }
    );
  }

  // TODO: load the Stripe account ID from your DB
  const stripeAccountId = await getStripeAccountForLocation(locationId);

  if (!stripeAccountId) {
    return Response.json({
      success: true,
      data: {
        connected: false,
        status: 'not_connected',
        locationId,
      },
    });
  }

  try {
    const stripe = await createStripeClient();
    const account = await stripe.accounts.retrieve(stripeAccountId);

    const isComplete =
      account.charges_enabled &&
      account.payouts_enabled &&
      !account.requirements?.currently_due?.length;

    return Response.json({
      success: true,
      data: {
        connected: true,
        status: isComplete ? 'active' : 'incomplete',
        locationId,
        stripeAccountId,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        requirementsDue: account.requirements?.currently_due || [],
      },
    });
  } catch (error) {
    console.error('Stripe Connect status check error', {
      locationId,
      stripeAccountId,
      message: error.message,
    });
    return Response.json(
      { success: false, message: 'Failed to retrieve Stripe account status', error: error.message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helper – replace with a real DB lookup
// ---------------------------------------------------------------------------
async function getStripeAccountForLocation(locationId) {
  // TODO: e.g. const record = await db.stripeConnections.findOne({ locationId });
  // return record?.stripeAccountId ?? null;
  return null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
