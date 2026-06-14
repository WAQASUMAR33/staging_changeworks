export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildStripeConnectOAuthUrl } from '@/app/lib/payment-provider/stripe';
import { generateStateToken } from '@/app/lib/payment-provider/crypto';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  const email      = searchParams.get('email') ?? undefined;

  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  const state   = generateStateToken({ locationId, source: 'stripe-connect' });
  const authUrl = buildStripeConnectOAuthUrl(state, email);
  console.log(`[Stripe Auth] ▶ redirecting | locationId=${locationId} | clientId=${process.env.STRIPE_CONNECT_CLIENT_ID ?? 'MISSING'} | redirectUri=${process.env.STRIPE_CONNECT_REDIRECT_URI ?? 'MISSING'}`);
  return NextResponse.redirect(authUrl);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
