export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getConnectedAccount } from '@/app/lib/payment-provider/stripe';
import { saveStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { connectGHLPaymentProvider } from '@/app/lib/payment-provider/ghl';
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  try {
    const { locationId, stripeAccountId } = await request.json();
    console.log(`[connect/direct] ▶ locationId=${locationId} | stripeAccountId=${stripeAccountId}`);
    if (!locationId)      return NextResponse.json({ error: 'locationId is required' },      { status: 400 });
    if (!stripeAccountId) return NextResponse.json({ error: 'stripeAccountId is required' }, { status: 400 });
    if (!stripeAccountId.startsWith('acct_')) {
      return NextResponse.json({ error: 'Invalid Stripe account ID — must start with acct_' }, { status: 400 });
    }
    // Try to retrieve the Stripe account — non-fatal if it fails (e.g. key mode mismatch).
    // We still save the connection so the org can accept payments; the status fields
    // will be verified correctly once the live keys are configured in Vercel.
    let account = null;
    let apiError = null;
    try {
      account = await getConnectedAccount(stripeAccountId);
    } catch (err) {
      apiError = err.message;
      console.warn('[connect/direct] getConnectedAccount failed (saving anyway):', err.message);
    }

    const { getPaymentMode, getStripePublishableKey } = await import('@/app/lib/payment-mode');
    const mode   = await getPaymentMode();
    const pubKey = await getStripePublishableKey();

    console.log(`[connect/direct] saving | mode=${mode} | pubKey=${pubKey ? pubKey.slice(0,12)+'...' : 'MISSING'} | livemode=${mode === 'live'}`);
    await saveStripeAccount(locationId, {
      stripeAccountId,
      accessToken:     'direct',
      refreshToken:    null,
      publishableKey:  pubKey,
      livemode:        mode === 'live',
      tokenType:       'direct',
      scope:           null,
    });
    console.log(`[connect/direct] ✅ Stripe account saved for ${locationId}`);
    try {
      await connectGHLPaymentProvider(locationId);
    } catch (err) {
      console.warn('[connect/direct] connectGHLPaymentProvider failed (non-fatal):', err.message);
    }
    return NextResponse.json({
      connected:        true,
      stripeAccountId,
      displayName:      account?.display_name || account?.business_profile?.name || '',
      email:            account?.email         || '',
      chargesEnabled:   account?.charges_enabled   ?? true,
      payoutsEnabled:   account?.payouts_enabled   ?? true,
      detailsSubmitted: account?.details_submitted ?? true,
      livemode:         mode === 'live',
      ...(apiError ? { apiError } : {}),
    });
  } catch (err) {
    console.error('[connect/direct]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
