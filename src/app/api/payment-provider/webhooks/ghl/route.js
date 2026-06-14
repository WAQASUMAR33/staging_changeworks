export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import {
  createPaymentIntent, createRefund, createCustomer, createSubscription, getPrice,
  createProduct, createPrice, updateProduct, archivePrice, setProductDefaultPrice,
} from '@/app/lib/payment-provider/stripe';
import {
  getStripeAccount, saveStripeAccount, createWebhookLog, updateWebhookLog, upsertPaymentEvent,
  saveProductSync, getProductSync, deleteProductSync, savePriceSync, getPriceSync, deletePriceSync,
} from '@/app/lib/payment-provider/tokenStore';
import { prisma } from '@/app/lib/prisma';
import { getPaymentMode, getStripePublishableKey } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

const GHL_CLIENT_SECRET = process.env.GHL_APP_CLIENT_SECRET;
// GHL signs webhooks with the Shared Secret key (separate from the OAuth Client Secret)
const GHL_WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET || process.env.GHL_APP_CLIENT_SECRET;

function verifyGHLWebhook(rawBody, signature) {
  if (!signature) return false;
  const expected = createHmac('sha256', GHL_WEBHOOK_SECRET).update(rawBody).digest('hex');
  // Handle bare hex or "sha256=<hex>" prefix
  const cleaned = signature.startsWith('sha256=') ? signature.slice(7) : signature;
  return expected === cleaned;
}

export async function POST(request) {
  const rawBody = Buffer.from(await request.arrayBuffer());
  const signature =
    request.headers.get('x-ghl-signature') ||
    request.headers.get('x-wl-signature')  ||
    request.headers.get('x-hub-signature-256') ||
    null;

  let rawType = '';
  try { rawType = JSON.parse(rawBody.toString('utf-8'))?.type ?? ''; } catch {}

  console.log(`[GHL Webhook] ▶ Received type=${rawType} | signature=${signature ? 'present' : 'MISSING'} | bodyLen=${rawBody.length}`);

  const isPaymentEvent = ['PAYMENT_PROVIDER_CHARGE', 'PAYMENT_PROVIDER_REFUND', 'INSTALL', 'UNINSTALL'].includes(rawType);
  if (GHL_CLIENT_SECRET && signature && isPaymentEvent) {
    const valid = verifyGHLWebhook(rawBody, signature);
    console.log(`[GHL Webhook] Signature check: ${valid ? '✅ valid' : '❌ MISMATCH'}`);
    if (!valid) console.warn('[GHL Webhook] Proceeding despite signature mismatch.');
  } else if (isPaymentEvent && !signature) {
    console.warn('[GHL Webhook] No signature header received for payment event.');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { type, locationId, data } = payload;
  const eventId = payload.eventId ?? `ghl-${Date.now()}-${Math.random()}`;

  await createWebhookLog({ source: 'GHL', eventId, eventType: type, locationId: locationId ?? undefined, payload });

  try {
    switch (type) {
      case 'PAYMENT_PROVIDER_CHARGE': {
        console.log(`[GHL CHARGE] locationId=${locationId} | amount=${data?.amount} | currency=${data?.currency} | priceId=${data?.priceId ?? 'none'} | contact=${JSON.stringify(data?.contact ?? {})}`);
        let stripeAccount = await getStripeAccount(locationId);
        console.log(`[GHL CHARGE] getStripeAccount(${locationId}): ${stripeAccount ? 'FOUND → ' + stripeAccount.stripeAccountId : 'NULL — trying fallback'}`);

        // Fallback: look up org by ghlId / ghlAccounts and auto-connect Stripe account
        if (!stripeAccount) {
          try {
            let org = await prisma.organization.findFirst({
              where: { OR: [{ ghlId: locationId }, { ghlAccounts: { some: { ghl_location_id: locationId } } }] },
              select: { stripeAccountId: true },
            });
            if (!org?.stripeAccountId) {
              const install = await prisma.gHLAppInstallation.findUnique({ where: { location_id: locationId }, select: { ghl_id: true } });
              if (install?.ghl_id) {
                org = await prisma.organization.findFirst({ where: { ghlId: install.ghl_id }, select: { stripeAccountId: true } });
              }
            }
            if (org?.stripeAccountId) {
              const mode    = await getPaymentMode();
              const pubKey  = await getStripePublishableKey();
              await saveStripeAccount(locationId, {
                stripeAccountId: org.stripeAccountId,
                accessToken: 'direct', refreshToken: null,
                publishableKey: pubKey, livemode: mode === 'live', tokenType: 'direct', scope: null,
              });
              stripeAccount = await getStripeAccount(locationId);
              console.log(`[GHL Webhook] Auto-connected Stripe ${org.stripeAccountId} for location ${locationId}`);
            }
          } catch (fbErr) {
            console.warn('[GHL Webhook] Fallback org lookup failed:', fbErr.message);
          }
        }

        if (!stripeAccount) {
          console.error(`[GHL CHARGE] ❌ No Stripe account found for locationId=${locationId} even after fallback. Returning 404.`);
          await updateWebhookLog(eventId, 'FAILED', `No Stripe account for location ${locationId}`);
          return NextResponse.json({ error: `No Stripe account connected for location ${locationId}` }, { status: 404 });
        }
        console.log(`[GHL CHARGE] ✅ Stripe account resolved: ${stripeAccount.stripeAccountId} (livemode=${stripeAccount.livemode})`);
        const contact       = data.contact ?? {};
        const customerName  = (contact.firstName || contact.lastName) ? [contact.firstName, contact.lastName].filter(Boolean).join(' ') : (data.customerName ?? null);
        const customerEmail = contact.email ?? data.email ?? null;
        const customerPhone = contact.phone ?? data.phone ?? null;
        const ghlTransactionId = data.transactionId ?? data.entityId ?? null;

        const ghlPriceId   = data.priceId   ?? data.variantId   ?? null;
        const ghlProductId = data.productId ?? null;
        let isRecurring = false, stripePriceId = null;

        if (ghlPriceId) {
          try {
            const priceSync = await getPriceSync(locationId, ghlPriceId);
            if (priceSync?.stripePriceId) {
              stripePriceId = priceSync.stripePriceId;
              const stripePrice = await getPrice(stripePriceId, stripeAccount.stripeAccountId);
              isRecurring = !!stripePrice.recurring;
            }
          } catch {}
        }
        if (!isRecurring && ghlProductId) {
          try {
            const productSync = await getProductSync(locationId, ghlProductId);
            if (productSync?.stripePriceId) {
              stripePriceId = productSync.stripePriceId;
              const stripePrice = await getPrice(stripePriceId, stripeAccount.stripeAccountId);
              isRecurring = !!stripePrice.recurring;
            }
          } catch {}
        }
        if (!isRecurring) isRecurring = data.recurring === true || data.type === 'RECURRING' || !!data.interval;

        const sharedMeta = {
          locationId, entityId: data.entityId, entityType: data.entityType ?? (isRecurring ? 'subscription' : 'invoice'),
          ghlTransactionId, ghlContactId: data.contactId ?? null, customerName, customerEmail, customerPhone,
        };

        if (isRecurring && stripePriceId) {
          const customer = await createCustomer({ stripeAccountId: stripeAccount.stripeAccountId, email: customerEmail, name: customerName, phone: customerPhone, metadata: { locationId, entityId: data.entityId } });
          const subscription = await createSubscription({ stripeAccountId: stripeAccount.stripeAccountId, customerId: customer.id, priceId: stripePriceId, metadata: sharedMeta });
          const paymentIntent = subscription.latest_invoice?.payment_intent;
          if (!paymentIntent?.client_secret) {
            // Subscription created but no immediate payment required (e.g. free trial / $0 price).
            // Return success — GHL will see the subscription as active without a checkout step.
            await updateWebhookLog(eventId, 'PROCESSED');
            return NextResponse.json({ success: true, message: 'Subscription created, no immediate payment required' });
          }
          // Donor account is created only after payment succeeds (via Stripe webhook payment_intent.succeeded)
          await updateWebhookLog(eventId, 'PROCESSED');
          const subPubKey = stripeAccount.publishableKey || await getStripePublishableKey();
          console.log(`[GHL CHARGE] ✅ Subscription charge — returning clientSecret to GHL`);
          return NextResponse.json({ clientSecret: paymentIntent.client_secret, publishableKey: subPubKey });
        }

        console.log(`[GHL CHARGE] Creating one-time PaymentIntent: amount=${data.amount} ${data.currency ?? 'usd'} on ${stripeAccount.stripeAccountId}`);
        const intent = await createPaymentIntent({ amount: data.amount, currency: data.currency ?? 'usd', stripeAccountId: stripeAccount.stripeAccountId, metadata: sharedMeta });
        console.log(`[GHL CHARGE] ✅ PaymentIntent created: ${intent.id}`);
        try {
          await upsertPaymentEvent({ locationId, stripeAccountId: stripeAccount.stripeAccountId, paymentIntentId: intent.id, entityId: data.entityId ?? null, entityType: data.entityType ?? 'invoice', amount: data.amount, currency: data.currency ?? 'usd', status: 'PENDING', customerName, customerEmail, customerPhone });
        } catch (dbErr) {
          console.warn('[GHL CHARGE] upsertPaymentEvent failed (non-fatal):', dbErr.message);
        }
        await updateWebhookLog(eventId, 'PROCESSED');
        const chargePubKey = stripeAccount.publishableKey || await getStripePublishableKey();
        console.log(`[GHL CHARGE] ✅ Returning clientSecret=${intent.id} + publishableKey=${chargePubKey ? chargePubKey.slice(0,12)+'...' : 'EMPTY'} to GHL`);
        return NextResponse.json({ clientSecret: intent.client_secret, publishableKey: chargePubKey });
      }

      case 'PAYMENT_PROVIDER_REFUND': {
        const stripeAccount = await getStripeAccount(locationId);
        if (!stripeAccount) { await updateWebhookLog(eventId, 'FAILED', `No Stripe account for location ${locationId}`); return NextResponse.json({ error: 'Stripe account not connected' }, { status: 404 }); }
        const refund = await createRefund({ paymentIntentId: data.externalTransactionId, stripeAccountId: stripeAccount.stripeAccountId, amount: data.amount, reason: data.reason });
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ refundId: refund.id, status: refund.status });
      }

      case 'INSTALL':
        // Re-register the payment provider every time the app is installed/reinstalled
        if (locationId) {
          try {
            const { connectGHLPaymentProvider } = await import('@/app/lib/payment-provider/ghl');
            await connectGHLPaymentProvider(locationId);
            console.log(`[GHL Webhook] ✅ Payment provider re-connected for ${locationId} on INSTALL`);
          } catch (installErr) {
            console.error(`[GHL Webhook] ❌ INSTALL connectGHLPaymentProvider FAILED for ${locationId}:`, installErr.message);
          }
        }
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ received: true });

      case 'UNINSTALL':
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ received: true });

      case 'ProductCreate': {
        const stripeAccount = await getStripeAccount(locationId);
        if (!stripeAccount) { await updateWebhookLog(eventId, 'SKIPPED', 'No Stripe account'); break; }
        const prod = data ?? payload;
        const ghlProductId = prod.id ?? prod._id;
        const name = prod.name ?? prod.title;
        if (!name || !ghlProductId) { await updateWebhookLog(eventId, 'SKIPPED', 'Missing product name/id'); break; }
        const variant = prod.variants?.[0] ?? prod.prices?.[0] ?? {};
        const priceAmount = variant.price ?? variant.amount ?? prod.price ?? 0;
        const currency = (variant.currency ?? prod.currency ?? 'usd').toLowerCase();
        const isRecurring = !!(prod.recurring) || prod.productType === 'RECURRING';
        const interval = prod.interval ?? variant.interval ?? 'month';
        const stripeProduct = await createProduct({ stripeAccountId: stripeAccount.stripeAccountId, name, description: prod.description ?? undefined });
        let stripePrice = null;
        if (priceAmount > 0) {
          stripePrice = await createPrice({ stripeAccountId: stripeAccount.stripeAccountId, productId: stripeProduct.id, amount: Math.round(Number(priceAmount) * 100), currency, recurring: isRecurring ? { interval } : undefined });
        }
        await saveProductSync(locationId, ghlProductId, stripeProduct.id, stripePrice?.id ?? null);
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ received: true, stripeProductId: stripeProduct.id });
      }

      case 'ProductUpdate': {
        const stripeAccount = await getStripeAccount(locationId);
        if (!stripeAccount) { await updateWebhookLog(eventId, 'SKIPPED', 'No Stripe account'); break; }
        const prod = data ?? payload;
        const ghlProductId = prod.id ?? prod._id;
        if (!ghlProductId) { await updateWebhookLog(eventId, 'SKIPPED', 'Missing product id'); break; }
        const mapping = await getProductSync(locationId, ghlProductId);
        if (!mapping) { await updateWebhookLog(eventId, 'SKIPPED', 'No Stripe mapping found'); break; }
        await updateProduct(stripeAccount.stripeAccountId, mapping.stripeProductId, { ...(prod.name ? { name: prod.name } : {}), ...(prod.description ? { description: prod.description } : {}) });
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ received: true });
      }

      case 'ProductDelete': {
        const stripeAccount = await getStripeAccount(locationId);
        if (!stripeAccount) { await updateWebhookLog(eventId, 'SKIPPED', 'No Stripe account'); break; }
        const prod = data ?? payload;
        const ghlProductId = prod.id ?? prod._id;
        if (!ghlProductId) { await updateWebhookLog(eventId, 'SKIPPED', 'Missing product id'); break; }
        const mapping = await getProductSync(locationId, ghlProductId);
        if (!mapping) { await updateWebhookLog(eventId, 'SKIPPED', 'No Stripe mapping found'); break; }
        await updateProduct(stripeAccount.stripeAccountId, mapping.stripeProductId, { active: false });
        await deleteProductSync(locationId, ghlProductId);
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ received: true });
      }

      case 'PriceCreate': {
        const stripeAccount = await getStripeAccount(locationId);
        if (!stripeAccount) { await updateWebhookLog(eventId, 'SKIPPED', 'No Stripe account'); break; }
        const priceData = data ?? payload;
        const ghlPriceId = priceData.id ?? priceData._id ?? null;
        const ghlProductId = priceData.productId ?? priceData.product ?? priceData.product_id ?? null;
        if (!ghlPriceId || !ghlProductId) { await updateWebhookLog(eventId, 'SKIPPED', 'Missing price/product id'); break; }
        const productMapping = await getProductSync(locationId, ghlProductId);
        if (!productMapping) { await updateWebhookLog(eventId, 'SKIPPED', `No Stripe product mapping for ${ghlProductId}`); break; }
        const rawAmount = priceData.amount ?? priceData.price ?? priceData.unitAmount ?? 0;
        const amount = rawAmount < 1000 ? Math.round(Number(rawAmount) * 100) : Math.round(Number(rawAmount));
        const currency = (priceData.currency ?? 'usd').toLowerCase();
        const isRecurring = !!(priceData.recurring) || priceData.type === 'RECURRING';
        const interval = priceData.interval ?? priceData.recurringInterval ?? 'month';
        const stripePrice = await createPrice({ stripeAccountId: stripeAccount.stripeAccountId, productId: productMapping.stripeProductId, amount, currency, recurring: isRecurring ? { interval } : undefined });
        await savePriceSync(locationId, ghlPriceId, ghlProductId, stripePrice.id);
        await setProductDefaultPrice(stripeAccount.stripeAccountId, productMapping.stripeProductId, stripePrice.id);
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ received: true, stripePriceId: stripePrice.id });
      }

      case 'PriceUpdate': {
        const stripeAccount = await getStripeAccount(locationId);
        if (!stripeAccount) { await updateWebhookLog(eventId, 'SKIPPED', 'No Stripe account'); break; }
        const priceData = data ?? payload;
        const ghlPriceId = priceData.id ?? priceData._id;
        const ghlProductId = priceData.productId ?? priceData.product;
        if (!ghlPriceId) { await updateWebhookLog(eventId, 'SKIPPED', 'Missing price id'); break; }
        const priceMapping = await getPriceSync(locationId, ghlPriceId);
        const productMapping = ghlProductId ? await getProductSync(locationId, ghlProductId) : null;
        if (priceMapping?.stripePriceId) { try { await archivePrice(stripeAccount.stripeAccountId, priceMapping.stripePriceId); } catch {} }
        if (productMapping?.stripeProductId) {
          const amount = priceData.amount ?? priceData.price ?? 0;
          const currency = (priceData.currency ?? 'usd').toLowerCase();
          const isRecurring = !!(priceData.recurring) || priceData.type === 'RECURRING';
          const interval = priceData.interval ?? 'month';
          const newPrice = await createPrice({ stripeAccountId: stripeAccount.stripeAccountId, productId: productMapping.stripeProductId, amount: Math.round(Number(amount) * 100), currency, recurring: isRecurring ? { interval } : undefined });
          await savePriceSync(locationId, ghlPriceId, ghlProductId, newPrice.id);
          await setProductDefaultPrice(stripeAccount.stripeAccountId, productMapping.stripeProductId, newPrice.id);
        }
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ received: true });
      }

      case 'PriceDelete': {
        const stripeAccount = await getStripeAccount(locationId);
        if (!stripeAccount) { await updateWebhookLog(eventId, 'SKIPPED', 'No Stripe account'); break; }
        const priceData = data ?? payload;
        const ghlPriceId = priceData.id ?? priceData._id;
        if (!ghlPriceId) { await updateWebhookLog(eventId, 'SKIPPED', 'Missing price id'); break; }
        const mapping = await getPriceSync(locationId, ghlPriceId);
        if (mapping?.stripePriceId) { await archivePrice(stripeAccount.stripeAccountId, mapping.stripePriceId); await deletePriceSync(locationId, ghlPriceId); }
        await updateWebhookLog(eventId, 'PROCESSED');
        return NextResponse.json({ received: true });
      }

      default:
        await updateWebhookLog(eventId, 'SKIPPED');
        return NextResponse.json({ received: true });
    }
    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(`[GHL Webhook] Error handling ${type}:`, err.message);
    await updateWebhookLog(eventId, 'FAILED', err.message);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
