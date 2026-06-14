export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { exchangeStripeCode } from '@/app/lib/payment-provider/stripe';
import { saveStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { verifyStateToken } from '@/app/lib/payment-provider/crypto';
import { connectGHLPaymentProvider } from '@/app/lib/payment-provider/ghl';
import { prisma } from '@/app/lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const code  = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  const baseUrl     = process.env.NEXT_PUBLIC_APP_URL || '';
  const dashboardUrl = `${baseUrl}/organization/dashboard/payment-provider`;

  if (error) {
    return NextResponse.redirect(`${dashboardUrl}?error=stripe_denied`);
  }
  if (!code || !state) {
    return NextResponse.json({ error: 'Missing code or state' }, { status: 400 });
  }

  let stateData;
  try {
    stateData = verifyStateToken(state);
  } catch {
    return NextResponse.json({ error: 'Invalid state token' }, { status: 400 });
  }

  const { locationId } = stateData;
  if (!locationId) {
    return NextResponse.json({ error: 'No locationId in state' }, { status: 400 });
  }

  console.log(`[Stripe callback] ▶ code received | locationId=${locationId}`);
  let oauthToken;
  try {
    oauthToken = await exchangeStripeCode(code);
    console.log(`[Stripe callback] ✅ Token exchange OK | stripeAccountId=${oauthToken.stripe_user_id} | livemode=${oauthToken.livemode}`);
  } catch (err) {
    console.error('[Stripe OAuth] Token exchange failed:', err.message);
    return NextResponse.redirect(`${dashboardUrl}?error=stripe_token_exchange&locationId=${locationId}`);
  }

  const stripeAccountId = oauthToken.stripe_user_id;

  await saveStripeAccount(locationId, {
    stripeAccountId,
    accessToken:     oauthToken.access_token,
    refreshToken:    oauthToken.refresh_token,
    publishableKey:  oauthToken.stripe_publishable_key,
    livemode:        oauthToken.livemode,
    tokenType:       oauthToken.token_type,
    scope:           oauthToken.scope,
  });

  // Also sync stripeAccountId onto the Organization record so the org dashboard
  // can show the correct Stripe status without a separate ghlStripeConnection lookup.
  try {
    const org = await prisma.organization.findFirst({
      where: {
        OR: [
          { ghlId: locationId },
          { ghlAccounts: { some: { ghl_location_id: locationId } } },
        ],
      },
      select: { id: true, stripeAccountId: true },
    });
    if (org && org.stripeAccountId !== stripeAccountId) {
      await prisma.organization.update({
        where: { id: org.id },
        data:  { stripeAccountId },
      });
      console.log(`[Stripe callback] Synced stripeAccountId ${stripeAccountId} → org ${org.id}`);
    }
  } catch (orgErr) {
    console.warn('[Stripe callback] Failed to sync stripeAccountId to org (non-fatal):', orgErr.message);
  }

  try {
    await connectGHLPaymentProvider(locationId);
  } catch (err) {
    console.warn('[Stripe callback] connectGHLPaymentProvider failed (non-fatal):', err.message);
  }

  return NextResponse.redirect(`${dashboardUrl}?locationId=${locationId}&connected=stripe`);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
