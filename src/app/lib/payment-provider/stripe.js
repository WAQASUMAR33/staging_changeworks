/**
 * lib/payment-provider/stripe.js
 * Stripe SDK helpers for the GHL payment provider (Stripe Connect).
 * Uses payment-mode.js so sandbox/live keys are switched automatically.
 */

import { createStripeClient, getStripeConnectWebhookSecret } from '@/app/lib/payment-mode';

// ─── Connect OAuth ────────────────────────────────────────────────────────────

export function buildStripeConnectOAuthUrl(state, email) {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     process.env.STRIPE_CONNECT_CLIENT_ID,
    scope:         'read_write',
    redirect_uri:  process.env.STRIPE_CONNECT_REDIRECT_URI,
    state,
    ...(email ? { 'stripe_user[email]': email } : {}),
  });
  return `https://connect.stripe.com/oauth/authorize?${params.toString()}`;
}

export async function exchangeStripeCode(code) {
  const stripe = await createStripeClient();
  return stripe.oauth.token({ grant_type: 'authorization_code', code });
}

export async function deauthorizeStripeAccount(stripeAccountId) {
  const stripe = await createStripeClient();
  await stripe.oauth.deauthorize({
    client_id:      process.env.STRIPE_CONNECT_CLIENT_ID,
    stripe_user_id: stripeAccountId,
  });
}

// ─── Payment Intents ──────────────────────────────────────────────────────────

export async function createPaymentIntent({ amount, currency, stripeAccountId, applicationFeeAmount, metadata = {}, customerId, livemode = null }) {
  const stripe = await createStripeClient(livemode);
  return stripe.paymentIntents.create(
    {
      amount, currency, automatic_payment_methods: { enabled: true },
      application_fee_amount: applicationFeeAmount, metadata,
      ...(customerId ? { customer: customerId } : {}),
    },
    { stripeAccount: stripeAccountId }
  );
}

export async function getPaymentIntent(paymentIntentId, stripeAccountId) {
  const stripe = await createStripeClient();
  return stripe.paymentIntents.retrieve(paymentIntentId, { stripeAccount: stripeAccountId });
}

export async function updatePaymentIntentMetadata(paymentIntentId, metadata, stripeAccountId, livemode = null) {
  const stripe = await createStripeClient(livemode);
  return stripe.paymentIntents.update(paymentIntentId, { metadata }, { stripeAccount: stripeAccountId });
}

export async function getPaymentIntentWithCharge(paymentIntentId, stripeAccountId, livemode = null) {
  const stripe = await createStripeClient(livemode);
  return stripe.paymentIntents.retrieve(
    paymentIntentId,
    { expand: ['latest_charge', 'customer'] },
    { stripeAccount: stripeAccountId }
  );
}

export async function createRefund({ paymentIntentId, stripeAccountId, amount, reason }) {
  const stripe = await createStripeClient();
  return stripe.refunds.create(
    { payment_intent: paymentIntentId, ...(amount ? { amount } : {}), ...(reason ? { reason } : {}) },
    { stripeAccount: stripeAccountId }
  );
}

export async function createAccountLink(stripeAccountId, returnUrl, refreshUrl) {
  const stripe = await createStripeClient();
  return stripe.accountLinks.create({
    account:     stripeAccountId,
    return_url:  returnUrl,
    refresh_url: refreshUrl,
    type:        'account_onboarding',
  });
}

export async function getConnectedAccount(stripeAccountId) {
  const stripe = await createStripeClient();
  return stripe.accounts.retrieve(stripeAccountId);
}

// ─── Customers & Subscriptions ────────────────────────────────────────────────

export async function createCustomer({ stripeAccountId, email, name, phone, metadata = {}, livemode = null }) {
  const stripe = await createStripeClient(livemode);
  return stripe.customers.create(
    { ...(email ? { email } : {}), ...(name ? { name } : {}), ...(phone ? { phone } : {}), metadata },
    { stripeAccount: stripeAccountId }
  );
}

export async function createSubscription({ stripeAccountId, customerId, priceId, applicationFeePercent, metadata = {}, livemode = null }) {
  const stripe = await createStripeClient(livemode);
  return stripe.subscriptions.create(
    {
      customer:         customerId,
      items:            [{ price: priceId }],
      payment_behavior: 'default_incomplete',
      expand:           ['latest_invoice.payment_intent'],
      ...(applicationFeePercent ? { application_fee_percent: applicationFeePercent } : {}),
      metadata,
    },
    { stripeAccount: stripeAccountId }
  );
}

export async function createInlineSubscription({ stripeAccountId, customerId, amount, currency, interval = 'month', productName = 'Subscription', applicationFeePercent, metadata = {}, livemode = null }) {
  const stripe = await createStripeClient(livemode);
  const product = await stripe.products.create({ name: productName }, { stripeAccount: stripeAccountId });
  return stripe.subscriptions.create(
    {
      customer:         customerId,
      items: [{ price_data: { currency, product: product.id, unit_amount: amount, recurring: { interval } } }],
      payment_behavior: 'default_incomplete',
      expand:           ['latest_invoice.payment_intent'],
      ...(applicationFeePercent ? { application_fee_percent: applicationFeePercent } : {}),
      metadata,
    },
    { stripeAccount: stripeAccountId }
  );
}

export async function getPrice(priceId, stripeAccountId, livemode = null) {
  const stripe = await createStripeClient(livemode);
  return stripe.prices.retrieve(priceId, { stripeAccount: stripeAccountId });
}

// ─── Products & Prices ────────────────────────────────────────────────────────

export async function createProduct({ stripeAccountId, name, description, images }) {
  const stripe = await createStripeClient();
  return stripe.products.create(
    { name, ...(description ? { description } : {}), ...(images?.length ? { images } : {}) },
    { stripeAccount: stripeAccountId }
  );
}

export async function updateProduct(stripeAccountId, productId, { name, description, active }) {
  const stripe = await createStripeClient();
  return stripe.products.update(
    productId,
    { ...(name !== undefined ? { name } : {}), ...(description !== undefined ? { description } : {}), ...(active !== undefined ? { active } : {}) },
    { stripeAccount: stripeAccountId }
  );
}

export async function listProducts(stripeAccountId, { limit = 20, startingAfter } = {}) {
  const stripe = await createStripeClient();
  return stripe.products.list(
    { limit, active: true, expand: ['data.default_price'], ...(startingAfter ? { starting_after: startingAfter } : {}) },
    { stripeAccount: stripeAccountId }
  );
}

export async function createPrice({ stripeAccountId, productId, amount, currency, recurring }) {
  const stripe = await createStripeClient();
  return stripe.prices.create(
    {
      product:     productId,
      unit_amount: amount,
      currency,
      ...(recurring ? { recurring: { interval: recurring.interval, interval_count: recurring.intervalCount ?? 1 } } : {}),
    },
    { stripeAccount: stripeAccountId }
  );
}

export async function listPrices(stripeAccountId, productId) {
  const stripe = await createStripeClient();
  return stripe.prices.list({ product: productId, active: true, limit: 10 }, { stripeAccount: stripeAccountId });
}

export async function archivePrice(stripeAccountId, priceId) {
  const stripe = await createStripeClient();
  return stripe.prices.update(priceId, { active: false }, { stripeAccount: stripeAccountId });
}

export async function setProductDefaultPrice(stripeAccountId, productId, priceId) {
  const stripe = await createStripeClient();
  return stripe.products.update(productId, { default_price: priceId }, { stripeAccount: stripeAccountId });
}

// ─── Webhook Verification ─────────────────────────────────────────────────────

export async function constructWebhookEvent(rawBody, signature) {
  const stripe = await createStripeClient();
  const secret = await getStripeConnectWebhookSecret();
  console.log(`[constructWebhookEvent] secret source prefix=${secret ? secret.slice(0, 14) + '...' : 'MISSING'} | bodyLen=${rawBody?.length ?? 0} | sigPresent=${!!signature}`);
  if (!secret) throw new Error('Stripe Connect webhook secret is not configured');
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
