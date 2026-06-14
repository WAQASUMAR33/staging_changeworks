export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import {
  createPaymentIntent, createCustomer, createSubscription,
  createInlineSubscription, updatePaymentIntentMetadata, getPrice,
} from '@/app/lib/payment-provider/stripe';
import { getStripeAccount, saveStripeAccount, upsertPaymentEvent, getPriceSync } from '@/app/lib/payment-provider/tokenStore';
import { getTransaction } from '@/app/lib/payment-provider/ghl';
import { getPaymentMode, getStripePublishableKey } from '@/app/lib/payment-mode';
import { prisma } from '@/app/lib/prisma';
import { corsHeaders } from '@/app/lib/cors';
// Donor account creation is handled exclusively in the Stripe webhook (payment_intent.succeeded)

export async function POST(request) {
  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Fee Formula:
  // - 90% goes to the organization
  // - 10% bucket = Stripe processing fee (~2.9%) + platform fee (~7.1%)
  // - One-time:     application_fee = (amount × 10%) − estimated Stripe fee → org nets exactly 90%
  // - Subscription: application_fee_percent = 7.1% (10% − 2.9%) → org nets ~90%
  // Special (frankie@vallartacares.com): 0% — full amount goes to org
  const SPECIAL_ORG_EMAIL = 'frankie@vallartacares.com';
  const PLATFORM_FEE_RATE = 0.10;
  const SUBSCRIPTION_FEE_PERCENT = 7.1; // 10% − Stripe's 2.9%

  const {
    locationId, amount, currency = 'usd', priceId, entityId, entityType,
    interval, isRecurring: isRecurringFlag, ghlSubscriptionId,
    metadata = {},
  } = body;

  if (!locationId) return NextResponse.json({ error: 'locationId is required' }, { status: 400 });
  if (!priceId && !amount) return NextResponse.json({ error: 'Either priceId or amount is required' }, { status: 400 });

  const finalEntityId   = entityId   || `ghl-${Date.now()}`;
  const finalEntityType = entityType || 'invoice';

  const RECURRING_ENTITY_TYPES = new Set(['subscription', 'subscription_order', 'recurring', 'recurring_order', 'subscriptions']);
  const entityTypeIsRecurring  = RECURRING_ENTITY_TYPES.has((entityType ?? '').toLowerCase());
  let resolvedInterval = interval || 'month';

  let ghlTransactionIsSubscription = false;
  const ghlTransactionId = metadata?.ghlTransactionId ?? null;
  if (ghlTransactionId && locationId) {
    const txn = await getTransaction(locationId, ghlTransactionId);
    if (txn) {
      const sourceType = (txn.entitySourceType ?? '').toLowerCase();
      ghlTransactionIsSubscription = sourceType === 'subscriptions' || sourceType === 'subscription';
      if (txn.interval) resolvedInterval = txn.interval;
    }
  }

  let stripeAccount = await getStripeAccount(locationId);
  console.log(`[create-intent] getStripeAccount(${locationId}):`, stripeAccount ? `found ${stripeAccount.stripeAccountId}` : 'null — attempting auto-connect');

  if (!stripeAccount) {
    // Fallback: auto-connect from org's stripeAccountId
    try {
      let org = await prisma.organization.findFirst({
        where: {
          OR: [
            { ghlId: locationId },
            { ghlAccounts: { some: { ghl_location_id: locationId } } },
          ],
        },
        select: { stripeAccountId: true, email: true },
      });

      // Fallback: look up via ghlAppInstallations (location_id → ghl_id → org.ghlId)
      if (!org?.stripeAccountId) {
        const install = await prisma.gHLAppInstallation.findUnique({
          where: { location_id: locationId },
          select: { ghl_id: true },
        });
        if (install?.ghl_id) {
          console.log(`[create-intent] Found install ghl_id=${install.ghl_id} for locationId=${locationId}`);
          org = await prisma.organization.findFirst({
            where: { ghlId: install.ghl_id },
            select: { stripeAccountId: true, email: true },
          });
        }
      }

      console.log(`[create-intent] Auto-connect org lookup for ${locationId}: stripeAccountId=${org?.stripeAccountId ?? null}`);
      if (org?.stripeAccountId) {
        try {
          const autoMode        = await getPaymentMode();
          const autoLivemode    = autoMode === 'live';
          const autoPubKey      = await getStripePublishableKey();
          await saveStripeAccount(locationId, {
            stripeAccountId: org.stripeAccountId,
            accessToken:     'direct',
            refreshToken:    null,
            publishableKey:  autoPubKey,
            livemode:        autoLivemode,
            tokenType:       'direct',
            scope:           null,
          });
          stripeAccount = await getStripeAccount(locationId);
          console.log(`[create-intent] Auto-connected Stripe ${org.stripeAccountId} for location ${locationId}`);
        } catch (saveErr) {
          console.error(`[create-intent] saveStripeAccount failed (code=${saveErr.code}):`, saveErr.message);
        }
      } else {
        console.warn(`[create-intent] No org with stripeAccountId found for locationId=${locationId}`);
      }
    } catch (err) {
      console.warn('[create-intent] Auto-connect fallback failed:', err.message);
    }
  }
  if (!stripeAccount) {
    return NextResponse.json({ error: 'This location has not connected a Stripe account yet' }, { status: 404 });
  }

  // Resolve org email for special-org fee check
  let orgEmail = null;
  try {
    const orgRow = await prisma.organization.findFirst({
      where: {
        OR: [
          { ghlId: locationId },
          { ghlAccounts: { some: { ghl_location_id: locationId } } },
          { stripeAccountId: stripeAccount.stripeAccountId },
        ],
      },
      select: { email: true },
    });
    orgEmail = orgRow?.email ?? null;
  } catch {}
  const isSpecialOrg = orgEmail?.toLowerCase() === SPECIAL_ORG_EMAIL.toLowerCase();

  // Use the admin-controlled payment_mode to pick the publishable key.
  // getStripePublishableKey() reads the same payment_mode setting used by createStripeClient().
  const effectivePubKey = stripeAccount.publishableKey || await getStripePublishableKey();

  const sharedMeta = { locationId, entityId: finalEntityId, entityType: finalEntityType, ...metadata };

  if (priceId) {
    let resolvedPriceId = priceId;
    try {
      const priceSync = await getPriceSync(locationId, priceId);
      if (priceSync?.stripePriceId) resolvedPriceId = priceSync.stripePriceId;
    } catch {}

    let price;
    try {
      price = await getPrice(resolvedPriceId, stripeAccount.stripeAccountId);
    } catch (err) {
      return NextResponse.json({ error: `Invalid price: ${err.message}` }, { status: 400 });
    }

    if (price.recurring) {
      const customer = await createCustomer({
        stripeAccountId: stripeAccount.stripeAccountId,
        email: metadata.customerEmail ?? null, name: metadata.customerName ?? null,
        phone: metadata.customerPhone ?? null,
        metadata: { locationId, entityId: finalEntityId },
      });
      const applicationFeePercent = isSpecialOrg ? 0 : SUBSCRIPTION_FEE_PERCENT;
      const subscription = await createSubscription({
        stripeAccountId: stripeAccount.stripeAccountId, customerId: customer.id, priceId,
        applicationFeePercent, metadata: { ...sharedMeta, entityType: 'subscription' },
      });
      const paymentIntent = subscription.latest_invoice?.payment_intent;
      if (!paymentIntent?.client_secret) {
        console.log(`[create-intent] Subscription created with no immediate payment | subId=${subscription.id}`);
        return NextResponse.json({ success: true, subscriptionId: subscription.id, mode: 'subscription', message: 'Subscription created, no immediate payment required' });
      }
      return NextResponse.json({
        clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id,
        subscriptionId: subscription.id, publishableKey: effectivePubKey,
        stripeAccountId: stripeAccount.stripeAccountId, mode: 'subscription',
      });
    }

    const priceAmount  = price.unit_amount ?? amount;
    const priceCurrency = price.currency ?? currency;
    const applicationFeeAmount = isSpecialOrg ? 0 : Math.max(0, Math.round(priceAmount * PLATFORM_FEE_RATE) - Math.round(priceAmount * 0.029) - 30);
    let oneTimeCustomerId;
    if (metadata.customerEmail) {
      const customer = await createCustomer({
        stripeAccountId: stripeAccount.stripeAccountId,
        email: metadata.customerEmail, name: metadata.customerName ?? null,
        phone: metadata.customerPhone ?? null,
        metadata: { locationId, entityId: finalEntityId },
      });
      oneTimeCustomerId = customer.id;
    }
    const intent = await createPaymentIntent({
      amount: priceAmount, currency: priceCurrency, stripeAccountId: stripeAccount.stripeAccountId,
      applicationFeeAmount: applicationFeeAmount || undefined, metadata: sharedMeta,
      customerId: oneTimeCustomerId,
    });
    return NextResponse.json({
      clientSecret: intent.client_secret, paymentIntentId: intent.id,
      publishableKey: effectivePubKey, stripeAccountId: stripeAccount.stripeAccountId, mode: 'payment',
    });
  }

  const shouldCreateSubscription = !!ghlSubscriptionId || isRecurringFlag || entityTypeIsRecurring || ghlTransactionIsSubscription;

  if (shouldCreateSubscription && amount) {
    const customer = await createCustomer({
      stripeAccountId: stripeAccount.stripeAccountId,
      email: metadata.customerEmail ?? null, name: metadata.customerName ?? null,
      phone: metadata.customerPhone ?? null,
      metadata: { locationId, entityId: finalEntityId },
    });
    const subscription = await createInlineSubscription({
      stripeAccountId: stripeAccount.stripeAccountId, customerId: customer.id,
      amount, currency, interval: resolvedInterval, productName: 'Subscription',
      applicationFeePercent: isSpecialOrg ? 0 : SUBSCRIPTION_FEE_PERCENT,
      metadata: { ...sharedMeta, entityType: 'subscription', ghlSubscriptionId: ghlSubscriptionId ?? null },
    });
    const paymentIntent = subscription.latest_invoice?.payment_intent;
    if (!paymentIntent?.client_secret) {
      console.log(`[create-intent] Inline subscription created with no immediate payment | subId=${subscription.id}`);
      return NextResponse.json({ success: true, subscriptionId: subscription.id, mode: 'subscription', message: 'Subscription created, no immediate payment required' });
    }
    try {
      await updatePaymentIntentMetadata(paymentIntent.id, {
        ...sharedMeta, entityType: 'subscription', ghlSubscriptionId: ghlSubscriptionId ?? null,
      }, stripeAccount.stripeAccountId);
    } catch {}
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret, paymentIntentId: paymentIntent.id,
      subscriptionId: subscription.id, publishableKey: effectivePubKey,
      stripeAccountId: stripeAccount.stripeAccountId, mode: 'subscription',
    });
  }

  const applicationFeeAmount = isSpecialOrg ? 0 : Math.max(0, Math.round(amount * PLATFORM_FEE_RATE) - Math.round(amount * 0.029) - 30);
  let directCustomerId;
  if (metadata.customerEmail) {
    try {
      const customer = await createCustomer({
        stripeAccountId: stripeAccount.stripeAccountId,
        email: metadata.customerEmail, name: metadata.customerName ?? null,
        phone: metadata.customerPhone ?? null,
        metadata: { locationId, entityId: finalEntityId },
      });
      directCustomerId = customer.id;
    } catch (custErr) {
      console.warn('[create-intent] Could not create Stripe customer (non-fatal):', custErr.message);
    }
  }
  let intent;
  try {
    intent = await createPaymentIntent({
      amount, currency, stripeAccountId: stripeAccount.stripeAccountId,
      applicationFeeAmount: applicationFeeAmount || undefined, metadata: sharedMeta,
      customerId: directCustomerId,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  try {
    await upsertPaymentEvent({
      locationId, stripeAccountId: stripeAccount.stripeAccountId, paymentIntentId: intent.id,
      entityId: finalEntityId, entityType: finalEntityType, amount, currency, status: 'PENDING',
      customerName: metadata.customerName ?? null, customerEmail: metadata.customerEmail ?? null,
      customerPhone: metadata.customerPhone ?? null,
    });
  } catch (dbErr) {
    console.warn('[create-intent] Failed to pre-save payment event (non-fatal):', dbErr.message);
  }

  return NextResponse.json({
    clientSecret: intent.client_secret, paymentIntentId: intent.id,
    publishableKey: effectivePubKey, stripeAccountId: stripeAccount.stripeAccountId, mode: 'payment',
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
