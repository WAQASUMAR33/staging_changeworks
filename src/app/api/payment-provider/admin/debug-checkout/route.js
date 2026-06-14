export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { getPaymentMode, getStripePublishableKey, createStripeClient } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

/**
 * GET /api/payment-provider/admin/debug-checkout?locationId=xxx
 * Full end-to-end checkout debug for a location:
 * - DB state (GhlStripeConnection, GhlConnection)
 * - Payment mode
 * - Stripe key mode match
 * - Can retrieve connected account
 * - Can create a $1 PaymentIntent on connected account
 */
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  if (!locationId) return NextResponse.json({ error: 'locationId is required' }, { status: 400 });

  const result = { locationId, steps: {} };

  // 1. Payment mode
  const mode = await getPaymentMode();
  const pubKey = await getStripePublishableKey();
  result.steps.paymentMode = { mode, pubKeyPrefix: pubKey?.slice(0, 20) ?? 'MISSING' };

  // 2. GhlStripeConnection
  const stripeConn = await prisma.ghlStripeConnection.findUnique({ where: { locationId } });
  result.steps.stripeConnection = stripeConn ? {
    found: true,
    stripeAccountId: stripeConn.stripeAccountId,
    livemode: stripeConn.livemode,
    tokenType: stripeConn.tokenType,
    publishableKey: stripeConn.publishableKey?.slice(0, 20) + '...',
    livemodeMatchesMode: stripeConn.livemode === (mode === 'live'),
  } : { found: false };

  // 3. GhlConnection
  const ghlConn = await prisma.ghlConnection.findUnique({ where: { locationId } });
  result.steps.ghlConnection = ghlConn ? {
    found: true,
    isStub: ghlConn.accessToken === 'auto-connect-stub',
    expiresAt: ghlConn.expiresAt,
    expired: ghlConn.expiresAt < new Date(),
  } : { found: false };

  if (!stripeConn) {
    result.verdict = 'FAIL: No GhlStripeConnection found for this location';
    return NextResponse.json(result);
  }

  // 4. Stripe key mode match check
  const keyModeOk = stripeConn.livemode === (mode === 'live');
  result.steps.keyModeMatch = {
    ok: keyModeOk,
    detail: keyModeOk
      ? `livemode=${stripeConn.livemode} matches payment_mode=${mode}`
      : `MISMATCH: livemode=${stripeConn.livemode} but payment_mode=${mode} — will use wrong Stripe key`,
  };

  // 5. Retrieve connected Stripe account
  try {
    const stripe = await createStripeClient(stripeConn.livemode);
    const account = await stripe.accounts.retrieve(stripeConn.stripeAccountId);
    result.steps.stripeAccountRetrieve = {
      ok: true,
      id: account.id,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      livemode: account.livemode ?? 'unknown',
    };
  } catch (err) {
    result.steps.stripeAccountRetrieve = { ok: false, error: err.message };
  }

  // 6. Create a test PaymentIntent ($1) on connected account
  try {
    const stripe = await createStripeClient(stripeConn.livemode);
    const intent = await stripe.paymentIntents.create(
      { amount: 100, currency: 'usd', automatic_payment_methods: { enabled: true } },
      { stripeAccount: stripeConn.stripeAccountId }
    );
    // Immediately cancel it — we just wanted to test creation
    await stripe.paymentIntents.cancel(intent.id, {}, { stripeAccount: stripeConn.stripeAccountId });
    result.steps.paymentIntentCreate = { ok: true, id: intent.id, status: 'created+cancelled' };
  } catch (err) {
    result.steps.paymentIntentCreate = { ok: false, error: err.message };
  }

  // Verdict
  const allOk = Object.values(result.steps).every(s => s.ok !== false);
  result.verdict = allOk ? 'ALL CHECKS PASSED — checkout should work' : 'ONE OR MORE CHECKS FAILED — see steps above';

  return NextResponse.json(result, { space: 2 });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
