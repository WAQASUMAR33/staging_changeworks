export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { exchangeGHLCode, connectGHLPaymentProvider } from '@/app/lib/payment-provider/ghl';
import { saveGHLTokens, saveStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { verifyStateToken } from '@/app/lib/payment-provider/crypto';
import { getConnectedAccount } from '@/app/lib/payment-provider/stripe';
import { getStripePublishableKey, getPaymentMode } from '@/app/lib/payment-mode';
import { prisma } from '@/app/lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  const reqUrl  = new URL(request.url);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${reqUrl.protocol}//${reqUrl.host}`;
  const successUrl  = `${baseUrl}/payment-provider/ghl-connected`;
  const dashboardUrl = `${baseUrl}/organization/dashboard/payment-provider`;

  const { searchParams } = reqUrl;
  const code             = searchParams.get('code');
  const state            = searchParams.get('state');
  const error            = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Log every incoming param so we can see exactly what GHL sent back
  console.log(`[GHL callback] ▶ INCOMING | code=${code ? code.slice(0,12)+'...' : 'MISSING'} | state=${state ? 'present' : 'MISSING'} | error=${error ?? 'none'} | error_description=${errorDescription ?? 'none'} | fullUrl=${reqUrl.pathname}${reqUrl.search}`);

  try {
    if (error) {
      console.error(`[GHL callback] ❌ GHL returned error | error=${error} | description=${errorDescription ?? 'none'}`);
      return NextResponse.redirect(`${successUrl}?error=ghl_denied&ghl_error=${encodeURIComponent(error)}&detail=${encodeURIComponent(errorDescription ?? '')}`);
    }
    if (!code) {
      console.error('[GHL callback] ❌ No code in callback — params:', Object.fromEntries(searchParams.entries()));
      return NextResponse.json({ error: 'Missing code' }, { status: 400 });
    }

    let stateData;
    if (state) {
      try {
        stateData = verifyStateToken(state);
        console.log(`[GHL callback] ✅ State verified | locationId=${stateData?.locationId}`);
      } catch (stateErr) {
        console.error('[GHL callback] ❌ Invalid state token:', stateErr.message);
        return NextResponse.json({ error: 'Invalid state token' }, { status: 400 });
      }
    }

    console.log(`[GHL callback] ▶ Exchanging code for token | client_id=${process.env.GHL_APP_CLIENT_ID ?? 'MISSING'} | redirect_uri=${process.env.GHL_REDIRECT_URI ?? 'MISSING'}`);
    let tokenData;
    try {
      tokenData = await exchangeGHLCode(code);
      console.log(`[GHL callback] ✅ Token exchange OK | locationId=${tokenData.locationId} | companyId=${tokenData.companyId} | userId=${tokenData.userId} | expiresIn=${tokenData.expires_in}`);
    } catch (err) {
      const detail = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      console.error('[GHL OAuth] Token exchange failed:', detail);
      return NextResponse.redirect(`${successUrl}?error=ghl_token_exchange&detail=${encodeURIComponent(detail)}`);
    }

    const locationId = tokenData.locationId ?? stateData?.locationId;
    if (!locationId) {
      return NextResponse.json({ error: 'No locationId in token response' }, { status: 400 });
    }

    console.log(`[GHL callback] saving tokens for locationId=${locationId}`);
    await saveGHLTokens(locationId, {
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at:    Date.now() + (tokenData.expires_in ?? 86400) * 1000,
      companyId:     tokenData.companyId,
      userId:        tokenData.userId,
      locationId,
    });

    console.log(`[GHL callback] ✅ GHL tokens saved | attempting connectGHLPaymentProvider for ${locationId}`);
    try {
      await connectGHLPaymentProvider(locationId);
      console.log(`[GHL callback] ✅ connectGHLPaymentProvider succeeded for ${locationId}`);
    } catch (err) {
      console.warn('[GHL callback] connectGHLPaymentProvider failed (non-fatal):', err.message);
    }

    // Auto-connect Stripe from org's stripeAccountId
    try {
      let org = await prisma.organization.findFirst({
        where: {
          OR: [
            { ghlId: locationId },
            { ghlAccounts: { some: { ghl_location_id: locationId } } },
          ],
        },
        select: { stripeAccountId: true },
      });
      // Fallback: look up via ghlAppInstallations (location_id → ghl_id → org.ghlId)
      if (!org?.stripeAccountId) {
        const install = await prisma.gHLAppInstallation.findUnique({
          where: { location_id: locationId },
          select: { ghl_id: true },
        });
        if (install?.ghl_id) {
          org = await prisma.organization.findFirst({
            where: { ghlId: install.ghl_id },
            select: { stripeAccountId: true },
          });
          console.log(`[GHL callback] Install lookup ghl_id=${install.ghl_id} → stripeAccountId=${org?.stripeAccountId ?? null}`);
        }
      }
      if (org?.stripeAccountId) {
        const account = await getConnectedAccount(org.stripeAccountId);
        const pubKey  = await getStripePublishableKey();
        const mode    = await getPaymentMode();
        await saveStripeAccount(locationId, {
          stripeAccountId: account.id,
          accessToken:     'direct',
          refreshToken:    null,
          publishableKey:  pubKey,
          livemode:        mode === 'live',
          tokenType:       'direct',
          scope:           null,
        });
        console.log(`[GHL callback] Auto-connected Stripe account ${account.id} for location ${locationId}`);
      }
    } catch (err) {
      console.warn('[GHL callback] Auto-connect Stripe failed (non-fatal):', err.message);
    }

    return NextResponse.redirect(`${dashboardUrl}?connected=ghl&locationId=${locationId}`);
  } catch (err) {
    console.error('[GHL callback] Unhandled error:', err.message);
    return NextResponse.redirect(`${successUrl}?error=ghl_callback_error&detail=${encodeURIComponent(err.message)}`);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
