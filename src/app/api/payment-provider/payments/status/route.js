export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPaymentIntent, createRefund } from '@/app/lib/payment-provider/stripe';
import { getStripeAccount, getPaymentEventByIntentId } from '@/app/lib/payment-provider/tokenStore';
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, apiKey, locationId } = body;
  console.log(`[Payment Status] ▶ type=${type} | locationId=${locationId} | apiKeyMatch=${apiKey === process.env.GHL_APP_CLIENT_SECRET} | body=${JSON.stringify(body)}`);

  if (!apiKey || apiKey !== process.env.GHL_APP_CLIENT_SECRET) {
    console.error(`[Payment Status] ❌ Unauthorized — apiKey mismatch. Received: ${apiKey?.substring(0,8)}... Expected starts with: ${process.env.GHL_APP_CLIENT_SECRET?.substring(0,8)}...`);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  switch (type) {
    case 'verify': {
      const { chargeId } = body;
      if (!chargeId) return NextResponse.json({ failed: true });
      let resolvedLocationId = locationId;
      let stripeAccountId;
      if (!resolvedLocationId) {
        const event = await getPaymentEventByIntentId(chargeId);
        resolvedLocationId = event?.locationId ?? null;
        stripeAccountId    = event?.stripeAccountId ?? null;
      }
      let stripeAccount = resolvedLocationId ? await getStripeAccount(resolvedLocationId) : null;
      if (!stripeAccount && stripeAccountId) stripeAccount = { stripeAccountId };
      if (!stripeAccount) return NextResponse.json({ failed: true });
      try {
        const intent = await getPaymentIntent(chargeId, stripeAccount.stripeAccountId);
        if (intent.status === 'succeeded') return NextResponse.json({ success: true });
        // 'requires_payment_method' = card declined / failed; 'canceled' = explicitly canceled
        if (['canceled', 'requires_payment_method'].includes(intent.status)) return NextResponse.json({ failed: true });
        return NextResponse.json({ success: false });
      } catch {
        return NextResponse.json({ failed: true });
      }
    }
    case 'refund': {
      const { chargeId, amount } = body;
      const stripeAccount = await getStripeAccount(locationId);
      if (!stripeAccount) return NextResponse.json({ success: false, message: 'No Stripe account' });
      try {
        const refund = await createRefund({
          paymentIntentId: chargeId, stripeAccountId: stripeAccount.stripeAccountId,
          amount: amount ? Math.round(amount * 100) : undefined,
        });
        return NextResponse.json({ success: true, id: refund.id, amount: refund.amount / 100, currency: refund.currency, message: 'Refund successful' });
      } catch (err) {
        return NextResponse.json({ success: false, message: err.message });
      }
    }
    case 'list_payment_methods':  return NextResponse.json([]);
    case 'charge_payment':        return NextResponse.json({ success: false, failed: true, message: 'Off-session charges not supported' });
    case 'create_subscription':   return NextResponse.json({ success: false, failed: true, message: 'Manual subscriptions not supported' });
    case 'cancel_subscription':   return NextResponse.json({ status: 'canceled' });
    default:
      return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 });
  }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId      = searchParams.get('locationId');
  const paymentIntentId = searchParams.get('paymentIntentId');

  if (!locationId || !paymentIntentId) {
    return NextResponse.json({ error: 'locationId and paymentIntentId are required' }, { status: 400 });
  }
  const stripeAccount = await getStripeAccount(locationId);
  if (!stripeAccount) {
    return NextResponse.json({ error: 'Stripe account not connected' }, { status: 404 });
  }
  try {
    const intent = await getPaymentIntent(paymentIntentId, stripeAccount.stripeAccountId);
    return NextResponse.json({ id: intent.id, status: intent.status, amount: intent.amount, currency: intent.currency, metadata: intent.metadata });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
