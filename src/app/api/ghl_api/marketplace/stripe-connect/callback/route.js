import { corsHeaders } from '@/app/lib/cors';


/**
 * Stripe Connect Onboarding - Return / Callback
 *
 * Stripe redirects here after the user completes (or exits) the hosted
 * onboarding flow.
 *
 * Query params: ?locationId=<ghlLocationId>&stripeAccountId=<acctId>
 *
 * We verify the account is fully set up, then persist the final state to DB
 * and redirect the user back to a success/failure screen.
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const locationId = searchParams.get('locationId');
  const stripeAccountId = searchParams.get('stripeAccountId');

  if (!locationId || !stripeAccountId) {
    return Response.json(
      { success: false, message: 'locationId and stripeAccountId are required' },
      { status: 400 }
    );
  }

  try {
    const stripe = await createStripeClient();
    const account = await stripe.accounts.retrieve(stripeAccountId);

    const isComplete =
      account.charges_enabled && account.payouts_enabled && !account.requirements?.currently_due?.length;

    console.log('Stripe Connect callback', {
      stripeAccountId,
      locationId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      isComplete,
    });

    // Auto-enable ACH debit capability if not already active or pending
    const achCapability = account.capabilities?.us_bank_account_ach_payments;
    if (achCapability !== 'active' && achCapability !== 'pending') {
      try {
        await stripe.accounts.update(stripeAccountId, {
          capabilities: {
            us_bank_account_ach_payments: { requested: true },
          },
        });
        console.log('ACH debit capability requested for account:', stripeAccountId);
      } catch (achErr) {
        console.warn('Could not request ACH capability (non-fatal):', achErr.message);
      }
    }

    if (isComplete) {
      // TODO: mark the connection as active in your DB
      // await db.stripeConnections.upsert({ locationId, stripeAccountId, status: 'active' });
    } else {
      // TODO: mark as pending (user left before finishing)
      // await db.stripeConnections.upsert({ locationId, stripeAccountId, status: 'pending' });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const destination = isComplete
      ? `${baseUrl}/ghl/stripe-connect/success?locationId=${locationId}`
      : `${baseUrl}/ghl/stripe-connect/incomplete?locationId=${locationId}`;

    return Response.redirect(destination, 302);
  } catch (error) {
    console.error('Stripe Connect callback error', {
      locationId,
      stripeAccountId,
      message: error.message,
    });
    return Response.json(
      { success: false, message: 'Failed to verify Stripe account', error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
