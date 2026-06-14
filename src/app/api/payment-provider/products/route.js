export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createProduct, createPrice, listProducts } from '@/app/lib/payment-provider/stripe';
import { getStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId    = searchParams.get('locationId');
  const limit         = parseInt(searchParams.get('limit') ?? '20', 10);
  const startingAfter = searchParams.get('startingAfter') ?? undefined;

  if (!locationId) return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  const stripeAccount = await getStripeAccount(locationId);
  if (!stripeAccount) return NextResponse.json({ error: 'No Stripe account connected for this location' }, { status: 404 });
  try {
    const result = await listProducts(stripeAccount.stripeAccountId, { limit, startingAfter });
    return NextResponse.json({ products: result.data, hasMore: result.has_more, nextCursor: result.data.at(-1)?.id ?? null });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { locationId, name, description, price, currency = 'usd', recurring } = body;
  if (!locationId || !name || price == null) {
    return NextResponse.json({ error: 'locationId, name, and price are required' }, { status: 400 });
  }
  const stripeAccount = await getStripeAccount(locationId);
  if (!stripeAccount) return NextResponse.json({ error: 'No Stripe account connected for this location' }, { status: 404 });
  try {
    const product = await createProduct({ stripeAccountId: stripeAccount.stripeAccountId, name, description });
    const priceObj = await createPrice({ stripeAccountId: stripeAccount.stripeAccountId, productId: product.id, amount: Math.round(price), currency, recurring });
    return NextResponse.json({ product, price: priceObj }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
