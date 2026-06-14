export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createAccountLink } from '@/app/lib/payment-provider/stripe';
import { getStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  const { locationId } = await request.json();
  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }
  const stored = await getStripeAccount(locationId);
  if (!stored) {
    return NextResponse.json({ error: 'Stripe account not connected. Complete OAuth first.' }, { status: 404 });
  }
  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL || '';
  const returnUrl  = `${baseUrl}/organization/dashboard/payment-provider?locationId=${locationId}&onboarding=complete`;
  const refreshUrl = `${baseUrl}/api/payment-provider/connect/onboard/refresh?locationId=${locationId}`;
  try {
    const link = await createAccountLink(stored.stripeAccountId, returnUrl, refreshUrl);
    return NextResponse.json({ url: link.url });
  } catch (err) {
    console.error('[connect/onboard]', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
