export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createStripeClient, getPaymentMode } from '@/app/lib/payment-mode';
import { prisma } from '@/app/lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

const WEBHOOK_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'charge.refunded',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

/**
 * POST /api/payment-provider/setup/register-stripe-webhook
 *
 * Registers (or re-registers) the Stripe webhook endpoint for this server,
 * then stores the signing secret in AppSetting so the webhook handler can
 * verify incoming events without a server restart.
 *
 * Body (optional): { baseUrl: "https://your-domain.com" }
 * Falls back to NEXT_PUBLIC_APP_URL env var.
 */
export async function POST(request) {
  try {
    let body = {};
    try { body = await request.json(); } catch {}

    const baseUrl = (
      body.baseUrl ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'https://app.changeworksfund.org'
    ).replace(/\/$/, '');

    const webhookUrl = `${baseUrl}/api/payment-provider/webhooks/stripe`;
    const mode = await getPaymentMode();
    // Force the Stripe client to match the current mode so the webhook is
    // registered on the correct Stripe account (live vs sandbox).
    const stripe = await createStripeClient(mode === 'live');
    const dbKey = mode === 'live'
      ? 'stripe_connect_webhook_secret_live'
      : 'stripe_connect_webhook_secret_sandbox';

    // Clear any stale secret from DB before registering so we never verify
    // with a secret from a deleted/old endpoint.
    await prisma.appSetting.deleteMany({ where: { key: dbKey } });

    // Remove any existing endpoints pointing to this URL
    const existing = await stripe.webhookEndpoints.list({ limit: 100 });
    for (const ep of existing.data) {
      if (ep.url === webhookUrl) {
        await stripe.webhookEndpoints.del(ep.id);
        console.log(`[register-webhook] Deleted old endpoint ${ep.id} → ${ep.url}`);
      }
    }

    // Create fresh Connect webhook (connect:true so events from all connected accounts are received)
    const endpoint = await stripe.webhookEndpoints.create({
      url: webhookUrl,
      enabled_events: WEBHOOK_EVENTS,
      connect: true,
      description: 'ChangeWorks GHL payment provider – auto-registered',
    });

    // Persist the signing secret so the handler picks it up immediately (no restart needed)
    await prisma.appSetting.upsert({
      where:  { key: dbKey },
      update: { value: endpoint.secret },
      create: { key: dbKey, value: endpoint.secret },
    });
    console.log(`[register-webhook] Secret stored in DB key=${dbKey} prefix=${endpoint.secret.slice(0, 14)}...`);

    console.log(`[register-webhook] Registered ${webhookUrl} (${mode}) — id: ${endpoint.id}`);

    return NextResponse.json({
      success: true,
      mode,
      webhookUrl,
      endpointId: endpoint.id,
      events: WEBHOOK_EVENTS,
      message: 'Webhook registered and secret stored. Stripe events will now trigger donor account creation.',
    });
  } catch (err) {
    console.error('[register-webhook] Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
