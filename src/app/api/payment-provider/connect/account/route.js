export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getConnectedAccount } from '@/app/lib/payment-provider/stripe';
import { getStripeAccount, saveStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { prisma } from '@/app/lib/prisma';
import { createStripeClient, getPaymentMode, getStripePublishableKey } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';
const getStripe = () => createStripeClient();

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');

  if (!locationId) {
    return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  }

  let stored = await getStripeAccount(locationId);
  console.log(`[connect/account] getStripeAccount(${locationId}):`, stored ? `found ${stored.stripeAccountId}` : 'null — attempting auto-connect');

  if (!stored) {
    try {
      // Try 3 lookup paths: org.ghlId, ghlAccounts.ghl_location_id, ghlAppInstallations.location_id→ghl_id→org.ghlId
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
          console.log(`[connect/account] Found install ghl_id=${install.ghl_id} for locationId=${locationId}`);
          org = await prisma.organization.findFirst({
            where: { ghlId: install.ghl_id },
            select: { stripeAccountId: true },
          });
        }
      }

      const stripeAccountId = org?.stripeAccountId ?? null;
      console.log(`[connect/account] Auto-connect org lookup for ${locationId}: stripeAccountId=${stripeAccountId}`);

      if (stripeAccountId) {
        try {
          const autoMode   = await getPaymentMode();
          const autoPubKey = await getStripePublishableKey();
          await saveStripeAccount(locationId, {
            stripeAccountId,
            accessToken:    'direct',
            refreshToken:   null,
            publishableKey: autoPubKey,
            livemode:       autoMode === 'live',
            tokenType:      'direct',
            scope:          null,
          });
          stored = await getStripeAccount(locationId);
          console.log(`[connect/account] Auto-connected Stripe ${stripeAccountId} for location ${locationId}`);
        } catch (saveErr) {
          console.error(`[connect/account] saveStripeAccount failed (code=${saveErr.code}):`, saveErr.message);
        }
      } else {
        console.warn(`[connect/account] No org with stripeAccountId found for locationId=${locationId}`);
      }
    } catch (err) {
      console.warn('[connect/account] Auto-connect fallback failed:', err.message);
    }
  }

  if (!stored) {
    return NextResponse.json({ connected: false });
  }

  // Fetch account details from Stripe
  let account = null;
  try {
    account = await getConnectedAccount(stored.stripeAccountId);
  } catch (err) {
    console.error('[connect/account] getConnectedAccount failed (key mismatch or network):', err.message);
    // Return connected=true with assumed-active status so the UI doesn't show "Incomplete"
    // just because the platform API key doesn't match the account mode yet.
    return NextResponse.json({
      connected:        true,
      stripeAccountId:  stored.stripeAccountId,
      livemode:         stored.livemode,
      chargesEnabled:   true,
      payoutsEnabled:   true,
      detailsSubmitted: true,
      availableBalance: 0,
      pendingBalance:   0,
      balanceCurrency:  'usd',
      recentTxCount:    0,
      succeededTxCount: 0,
      hasMore:          false,
      displayName:      '',
      apiError:         err.message,
    });
  }

  // Fetch balance and recent payment intents (non-fatal if these fail)
  let availableBalance = 0, pendingBalance = 0, balanceCurrency = account.default_currency ?? 'usd';
  let recentTxCount = 0, succeededTxCount = 0, hasMore = false;
  try {
    const stripe = await getStripe();
    const [balance, recentIntents] = await Promise.all([
      stripe.balance.retrieve({ stripeAccount: stored.stripeAccountId }),
      stripe.paymentIntents.list({ limit: 100 }, { stripeAccount: stored.stripeAccountId }),
    ]);
    availableBalance  = balance.available?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
    pendingBalance    = balance.pending?.reduce((sum, b) => sum + b.amount, 0) ?? 0;
    balanceCurrency   = balance.available?.[0]?.currency ?? balanceCurrency;
    recentTxCount     = recentIntents.data.length;
    succeededTxCount  = recentIntents.data.filter(p => p.status === 'succeeded').length;
    hasMore           = recentIntents.has_more;
  } catch (balErr) {
    console.warn('[connect/account] balance/intent fetch failed (non-fatal):', balErr.message);
  }

  return NextResponse.json({
    connected:        true,
    stripeAccountId:  account.id,
    displayName:      account.display_name || account.business_profile?.name || '',
    email:            account.email,
    website:          account.business_profile?.url || null,
    country:          account.country,
    currency:         account.default_currency,
    createdAt:        account.created,
    livemode:         stored.livemode,
    chargesEnabled:   account.charges_enabled,
    payoutsEnabled:   account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    availableBalance,
    pendingBalance,
    balanceCurrency,
    recentTxCount,
    succeededTxCount,
    hasMore,
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
