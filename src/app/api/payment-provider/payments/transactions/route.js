export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { prisma } from '@/app/lib/prisma';
import { createStripeClient } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';
const getStripe = () => createStripeClient();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId    = searchParams.get('locationId');
  const limit         = Math.min(parseInt(searchParams.get('limit') ?? '50', 10), 100);
  const startingAfter = searchParams.get('startingAfter') ?? undefined;

  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }
  const stripeAccount = await getStripeAccount(locationId);
  if (!stripeAccount) {
    return NextResponse.json({ error: 'No Stripe account connected for this location' }, { status: 404 });
  }
  try {
    const stripe = await getStripe();
    const intents = await stripe.paymentIntents.list(
      { limit, ...(startingAfter ? { starting_after: startingAfter } : {}) },
      { stripeAccount: stripeAccount.stripeAccountId }
    );

    const piIds = intents.data.map((pi) => pi.id);
    let dbEvents = [];
    try {
      dbEvents = await prisma.ghlPaymentEvent.findMany({
        where:  { paymentIntentId: { in: piIds } },
        select: { paymentIntentId: true, customerName: true, customerEmail: true, customerPhone: true },
      });
    } catch {}

    const dbMap = Object.fromEntries(dbEvents.map((e) => [e.paymentIntentId, e]));
    const transactions = intents.data.map((pi) => {
      const db = dbMap[pi.id] ?? {};
      return {
        id: pi.id, amount: pi.amount, currency: pi.currency, status: pi.status, created: pi.created,
        description: pi.description ?? null, entityId: pi.metadata?.entityId ?? null,
        entityType: pi.metadata?.entityType ?? null, receiptEmail: pi.receipt_email ?? null,
        paymentMethodTypes: pi.payment_method_types, latestCharge: pi.latest_charge ?? null,
        customerName:  db.customerName  || pi.metadata?.customerName  || null,
        customerEmail: db.customerEmail || pi.metadata?.customerEmail || pi.receipt_email || null,
        customerPhone: db.customerPhone || pi.metadata?.customerPhone || null,
      };
    });

    return NextResponse.json({
      transactions, hasMore: intents.has_more,
      nextCursor: intents.has_more ? intents.data[intents.data.length - 1]?.id : null,
    });
  } catch (err) {
    console.error('[transactions] Stripe list failed:', err.message);
    return NextResponse.json({ error: err.message, transactions: [], hasMore: false, nextCursor: null }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
