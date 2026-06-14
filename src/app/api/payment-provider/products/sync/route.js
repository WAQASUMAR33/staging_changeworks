export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { ghlClient } from '@/app/lib/payment-provider/ghl';
import { getStripeAccount, saveProductSync } from '@/app/lib/payment-provider/tokenStore';
import { listProducts, createProduct, createPrice } from '@/app/lib/payment-provider/stripe';
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { locationId } = body;
  if (!locationId) return NextResponse.json({ error: 'locationId is required' }, { status: 400 });

  const stripeAccount = await getStripeAccount(locationId);
  if (!stripeAccount) return NextResponse.json({ error: 'No Stripe account connected for this location' }, { status: 404 });

  let ghlProducts = [];
  try {
    const client = await ghlClient(locationId);
    const { data } = await client.get(`/products/?locationId=${locationId}&limit=100`);
    ghlProducts = data?.products ?? data?.list ?? data ?? [];
    if (!Array.isArray(ghlProducts)) ghlProducts = [];
  } catch (err) {
    return NextResponse.json({ error: `Failed to fetch GHL products: ${err.response?.data?.message ?? err.message}` }, { status: 502 });
  }

  if (ghlProducts.length === 0) {
    return NextResponse.json({ synced: 0, skipped: 0, errors: [], message: 'No products found in GHL' });
  }

  let existingStripeProducts = [];
  try {
    const result = await listProducts(stripeAccount.stripeAccountId, { limit: 100 });
    existingStripeProducts = result.data ?? [];
  } catch {}
  const existingNames = new Set(existingStripeProducts.map((p) => p.name.toLowerCase().trim()));

  let synced = 0, skipped = 0;
  const errors = [];

  for (const gp of ghlProducts) {
    const name = gp.name ?? gp.title ?? '';
    if (!name) { skipped++; continue; }
    if (existingNames.has(name.toLowerCase().trim())) { skipped++; continue; }

    const priceAmount = gp.price != null ? Math.round(Number(gp.price) * 100) : 0;
    const currency    = (gp.currency ?? 'usd').toLowerCase();
    const description = gp.description ?? gp.shortDescription ?? undefined;

    try {
      const stripeProduct = await createProduct({ stripeAccountId: stripeAccount.stripeAccountId, name, description });
      let stripePrice = null;
      if (priceAmount > 0) {
        const isRecurring = gp.recurring ?? gp.type === 'recurring';
        stripePrice = await createPrice({
          stripeAccountId: stripeAccount.stripeAccountId, productId: stripeProduct.id,
          amount: priceAmount, currency,
          recurring: isRecurring ? { interval: gp.interval ?? 'month' } : undefined,
        });
      }
      const ghlProductId = gp.id ?? gp._id;
      if (ghlProductId) await saveProductSync(locationId, ghlProductId, stripeProduct.id, stripePrice?.id ?? null);
      synced++;
    } catch (err) {
      errors.push(`"${name}": ${err.message}`);
    }
  }

  return NextResponse.json({ synced, skipped, errors, total: ghlProducts.length });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
