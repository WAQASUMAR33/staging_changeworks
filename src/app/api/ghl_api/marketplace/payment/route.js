import { prisma } from '../../../../lib/prisma';
import { createStripeClient } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

/**
 * GHL Marketplace – Server-side Payment (no checkout form)
 *
 * POST body:
 *  {
 *    ghl_id:      string  – GHL location ID → looks up Organization.ghlId in DB
 *    amount:      number  – Amount in dollars (e.g. 49.99)
 *    product_id:  string  – Stripe Price ID for subscriptions; label for one-time
 *    type:        string  – "one_time" | "subscription" | "recurring"
 *    donor_email: string  – Payer email (used to find/create Stripe Customer)
 *    donor_name?: string  – Optional payer name
 *  }
 *
 * Responses:
 *  { success: true, charged: true,  data: { ... } }          – payment completed server-side
 *  { success: true, charged: false, checkoutUrl: "https://..." } – no saved card yet,
 *                                                                  redirect user to this URL
 *                                                                  to enter card once
 */
export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const stripe = await createStripeClient();

  const { ghl_id, amount, product_id, type, donor_email, donor_name } = body;

  // ── Validate ────────────────────────────────────────────────────────────────
  if (!ghl_id) {
    return Response.json({ success: false, message: 'ghl_id is required' }, { status: 400 });
  }
  if (!donor_email) {
    return Response.json({ success: false, message: 'donor_email is required' }, { status: 400 });
  }
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return Response.json({ success: false, message: 'amount must be a positive number' }, { status: 400 });
  }
  if (!type || !['one_time', 'subscription', 'recurring'].includes(type)) {
    return Response.json(
      { success: false, message: 'type must be one_time, subscription, or recurring' },
      { status: 400 }
    );
  }
  if ((type === 'subscription' || type === 'recurring') && !product_id) {
    return Response.json(
      { success: false, message: 'product_id (Stripe Price ID) is required for subscriptions' },
      { status: 400 }
    );
  }

  // ── 1. Look up Organization by ghl_id ───────────────────────────────────────
  const organization = await prisma.organization.findFirst({
    where: { ghlId: ghl_id },
    select: { id: true, name: true, email: true, stripeAccountId: true, ghlId: true },
  });

  if (!organization) {
    return Response.json(
      { success: false, message: `No organization found for ghl_id: ${ghl_id}` },
      { status: 404 }
    );
  }

  if (!organization.stripeAccountId) {
    return Response.json(
      { success: false, message: `Organization "${organization.name}" has no Stripe account connected` },
      { status: 400 }
    );
  }

  const stripeAccountId = organization.stripeAccountId.trim();
  const amountInCents   = Math.round(Number(amount) * 100);
  const baseUrl         = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // ── 2. Find or create Stripe Customer on the connected account ───────────────
  const existingList = await stripe.customers.list(
    { email: donor_email, limit: 1 },
    { stripeAccount: stripeAccountId }
  );

  let customer = existingList.data[0] ?? null;

  if (!customer) {
    customer = await stripe.customers.create(
      {
        email: donor_email,
        ...(donor_name && { name: donor_name }),
        metadata: { ghl_id, organization_id: organization.id.toString() },
      },
      { stripeAccount: stripeAccountId }
    );
    console.log('Stripe customer created', { customerId: customer.id, stripeAccountId });
  } else {
    console.log('Stripe customer found', { customerId: customer.id, stripeAccountId });
  }

  // ── 3. Check for a saved (default) payment method ────────────────────────────
  const defaultPmId = customer.invoice_settings?.default_payment_method
    ?? customer.default_source
    ?? null;

  // If no saved payment method → create a Stripe Checkout Session
  // (user enters card once; Stripe saves it; future charges are off-session)
  if (!defaultPmId) {
    console.log('No saved payment method – creating Checkout Session for setup', {
      customerId: customer.id,
    });

    const sessionMode  = (type === 'one_time') ? 'payment' : 'subscription';
    const successUrl   = `${baseUrl}/ghl/payment/success?ghl_id=${ghl_id}&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl    = `${baseUrl}/ghl/payment/cancel?ghl_id=${ghl_id}`;

    const sessionParams =
      type === 'one_time'
        ? {
            mode: 'payment',
            line_items: [{
              price_data: {
                currency: 'usd',
                unit_amount: amountInCents,
                product_data: { name: product_id || `Payment to ${organization.name}` },
              },
              quantity: 1,
            }],
            payment_intent_data: {
              application_fee_amount: calcPlatformFee(amountInCents),
              metadata: { ghl_id, product_id: product_id || '', transaction_type: 'one_time' },
            },
          }
        : {
            mode: 'subscription',
            line_items: [{ price: product_id, quantity: 1 }],
            subscription_data: {
              application_fee_percent: 10,
              metadata: { ghl_id, product_id, transaction_type: 'subscription' },
            },
          };

    const session = await stripe.checkout.sessions.create(
      {
        customer: customer.id,
        success_url: successUrl,
        cancel_url:  cancelUrl,
        ...sessionParams,
      },
      { stripeAccount: stripeAccountId }
    );

    return Response.json({
      success:     true,
      charged:     false,
      message:     'No saved payment method – redirect user to checkoutUrl to enter card once',
      checkoutUrl: session.url,
      data: {
        sessionId:   session.id,
        customerId:  customer.id,
        stripeAccountId,
      },
    });
  }

  // ── 4. Has saved payment method → charge server-side, no form ───────────────
  try {
    if (type === 'one_time') {
      return await chargeOneTimeOffSession({
        stripe, stripeAccountId, amountInCents, product_id,
        customerId: customer.id, paymentMethodId: defaultPmId,
        organization, ghl_id,
      });
    }

    return await chargeSubscriptionOffSession({
      stripe, stripeAccountId, product_id,
      customerId: customer.id, paymentMethodId: defaultPmId,
      organization, ghl_id,
    });
  } catch (error) {
    console.error('GHL off-session charge failed', {
      ghl_id, type, message: error.message, stripeCode: error.code,
    });

    // Stripe requires authentication (3DS) – fall back to Checkout Session
    if (error.code === 'authentication_required' || error.code === 'requires_action') {
      const session = await stripe.checkout.sessions.create(
        {
          customer:    customer.id,
          success_url: `${baseUrl}/ghl/payment/success?ghl_id=${ghl_id}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url:  `${baseUrl}/ghl/payment/cancel?ghl_id=${ghl_id}`,
          mode: type === 'one_time' ? 'payment' : 'subscription',
          ...(type === 'one_time'
            ? {
                line_items: [{
                  price_data: {
                    currency: 'usd',
                    unit_amount: amountInCents,
                    product_data: { name: product_id || `Payment to ${organization.name}` },
                  },
                  quantity: 1,
                }],
                payment_intent_data: { application_fee_amount: calcPlatformFee(amountInCents) },
              }
            : {
                line_items: [{ price: product_id, quantity: 1 }],
                subscription_data: { application_fee_percent: 10 },
              }),
        },
        { stripeAccount: stripeAccountId }
      );

      return Response.json({
        success:     true,
        charged:     false,
        message:     'Card requires authentication – redirect user to checkoutUrl',
        checkoutUrl: session.url,
        data:        { sessionId: session.id, customerId: customer.id, stripeAccountId },
      });
    }

    return Response.json(
      { success: false, message: 'Payment failed', error: error.message, stripeCode: error.code },
      { status: 500 }
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Off-session one-time charge (no form, uses saved payment method)
// ─────────────────────────────────────────────────────────────────────────────
async function chargeOneTimeOffSession({
  stripe, stripeAccountId, amountInCents, product_id,
  customerId, paymentMethodId, organization, ghl_id,
}) {
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount:               amountInCents,
      currency:             'usd',
      customer:             customerId,
      payment_method:       paymentMethodId,
      application_fee_amount: calcPlatformFee(amountInCents),
      confirm:              true,   // charge immediately
      off_session:          true,   // no customer present
      description:          product_id || `Payment to ${organization.name}`,
      metadata: {
        ghl_id,
        product_id:        product_id || '',
        organization_id:   organization.id.toString(),
        organization_name: organization.name,
        transaction_type:  'one_time',
      },
    },
    { stripeAccount: stripeAccountId }
  );

  console.log('Off-session one-time charge succeeded', {
    paymentIntentId: paymentIntent.id,
    status: paymentIntent.status,
    stripeAccountId,
  });

  return Response.json({
    success: true,
    charged: true,
    type:    'one_time',
    data: {
      paymentIntentId: paymentIntent.id,
      status:          paymentIntent.status,
      amount:          amountInCents,
      stripeAccountId,
      customerId,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Off-session subscription (no form, Stripe auto-bills using saved payment method)
// ─────────────────────────────────────────────────────────────────────────────
async function chargeSubscriptionOffSession({
  stripe, stripeAccountId, product_id,
  customerId, paymentMethodId, organization, ghl_id,
}) {
  const subscription = await stripe.subscriptions.create(
    {
      customer:                customerId,
      items:                   [{ price: product_id }],
      default_payment_method:  paymentMethodId,
      application_fee_percent: 10,
      metadata: {
        ghl_id,
        product_id,
        organization_id:   organization.id.toString(),
        organization_name: organization.name,
        transaction_type:  'subscription',
      },
    },
    { stripeAccount: stripeAccountId }
  );

  console.log('Subscription created off-session', {
    subscriptionId: subscription.id,
    status:         subscription.status,
    stripeAccountId,
  });

  return Response.json({
    success: true,
    charged: true,
    type:    'subscription',
    data: {
      subscriptionId: subscription.id,
      status:         subscription.status,
      stripeAccountId,
      customerId,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Platform fee: 10% minus estimated Stripe fee (same formula as rest of app)
// ─────────────────────────────────────────────────────────────────────────────
function calcPlatformFee(amountInCents) {
  const platformBudget     = Math.round(amountInCents * 0.10);
  const estimatedStripeFee = Math.round(amountInCents * 0.029) + 30;
  return Math.max(0, platformBudget - estimatedStripeFee);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
