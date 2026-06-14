export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { updateProduct } from '@/app/lib/payment-provider/stripe';
import { getStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { corsHeaders } from '@/app/lib/cors';

export async function PUT(request, { params }) {
  const { id: productId } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { locationId, name, description } = body;
  if (!locationId) return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  const stripeAccount = await getStripeAccount(locationId);
  if (!stripeAccount) return NextResponse.json({ error: 'No Stripe account connected for this location' }, { status: 404 });
  try {
    const product = await updateProduct(stripeAccount.stripeAccountId, productId, { name, description });
    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const { id: productId } = await params;
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const { locationId } = body;
  if (!locationId) return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  const stripeAccount = await getStripeAccount(locationId);
  if (!stripeAccount) return NextResponse.json({ error: 'No Stripe account connected for this location' }, { status: 404 });
  try {
    const product = await updateProduct(stripeAccount.stripeAccountId, productId, { active: false });
    return NextResponse.json({ product });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
