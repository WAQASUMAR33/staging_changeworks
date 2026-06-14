export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createRefund } from '@/app/lib/payment-provider/stripe';
import { getStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  const { locationId, paymentIntentId, amount, reason } = await request.json();
  if (!locationId || !paymentIntentId) {
    return NextResponse.json({ error: 'locationId and paymentIntentId are required' }, { status: 400 });
  }
  const stripeAccount = await getStripeAccount(locationId);
  if (!stripeAccount) {
    return NextResponse.json({ error: 'Stripe account not connected for this location' }, { status: 404 });
  }
  try {
    const refund = await createRefund({ paymentIntentId, stripeAccountId: stripeAccount.stripeAccountId, amount, reason });
    return NextResponse.json({ refundId: refund.id, status: refund.status, amount: refund.amount });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
