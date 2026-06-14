export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { deauthorizeStripeAccount } from '@/app/lib/payment-provider/stripe';
import { getStripeAccount, saveStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  const { locationId } = await request.json();
  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }
  const account = await getStripeAccount(locationId);
  if (!account) {
    return NextResponse.json({ error: 'No Stripe account found for this location' }, { status: 404 });
  }

  // Attempt OAuth deauthorize — Stripe blocks this if the connected account has a
  // negative balance (platform is liable). In that case we skip it gracefully and
  // just remove our local record; the account stays connected on Stripe's side
  // until the balance is resolved.
  try {
    await deauthorizeStripeAccount(account.stripeAccountId);
  } catch (err) {
    console.warn('[Stripe Disconnect] deauthorize skipped:', err.message);
  }

  await saveStripeAccount(locationId, null);
  return NextResponse.json({ success: true });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
