/**
 * lib/payment-mode.js
 * Central helper for sandbox/live mode switching.
 * Mode is stored in AppSetting (key: 'payment_mode') and cached in memory.
 */

import { prisma } from '@/app/lib/prisma';
import Stripe from 'stripe';

// ─── In-memory cache ──────────────────────────────────────────────────────────
let _mode = null;          // null = not yet loaded
let _loadPromise = null;
const CACHE_TTL = 30_000;  // 30 seconds
let _cacheTime = 0;

/** Load mode from DB, with short-TTL caching to avoid a DB hit per request. */
async function loadMode() {
  const now = Date.now();
  if (_mode !== null && now - _cacheTime < CACHE_TTL) return _mode;
  if (_loadPromise) return _loadPromise;

  _loadPromise = prisma.appSetting
    .findUnique({ where: { key: 'payment_mode' } })
    .then((row) => {
      _mode = row?.value === 'live' ? 'live' : 'sandbox';
      _cacheTime = Date.now();
      _loadPromise = null;
      return _mode;
    })
    .catch(() => {
      _mode = 'sandbox';
      _cacheTime = Date.now();
      _loadPromise = null;
      return _mode;
    });

  return _loadPromise;
}

/** Get the current payment mode ('sandbox' | 'live'). */
export async function getPaymentMode() {
  return loadMode();
}

/** Returns the mode-appropriate Stripe secret key string (for raw HTTP calls). */
export async function getStripeSecretKey() {
  const mode = await loadMode();
  return mode === 'live'
    ? (process.env.STRIPE_SECRET_KEY_LIVE ?? '')
    : (process.env.STRIPE_SECRET_KEY_SANDBOX ?? '');
}

/** Call this when admin switches mode so the next request re-reads from DB. */
export function clearPaymentModeCache() {
  _mode = null;
  _loadPromise = null;
  _cacheTime = 0;
  // Also clear Stripe instance cache
  _stripeInstances.sandbox = null;
  _stripeInstances.live = null;
}

// ─── Stripe ───────────────────────────────────────────────────────────────────

const _stripeInstances = { sandbox: null, live: null };

/**
 * Get a mode-appropriate Stripe instance.
 * @param {boolean|null} [forceLivemode] – when provided, overrides the global payment_mode.
 *   Pass `stripeAccount.livemode` from a GHL Stripe connection to ensure the platform key
 *   matches the mode in which the connected account was created.
 */
export async function createStripeClient(forceLivemode = null) {
  const mode = forceLivemode !== null
    ? (forceLivemode ? 'live' : 'sandbox')
    : await loadMode();

  if (_stripeInstances[mode]) return _stripeInstances[mode];

  const key = mode === 'live'
    ? (process.env.STRIPE_SECRET_KEY_LIVE ?? '')
    : (process.env.STRIPE_SECRET_KEY_SANDBOX ?? '');

  _stripeInstances[mode] = new Stripe(key || 'sk_test_placeholder', { apiVersion: '2024-06-20' });
  return _stripeInstances[mode];
}

/** Returns the mode-appropriate publishable key (server-side). */
export async function getStripePublishableKey() {
  const mode = await loadMode();
  return mode === 'live'
    ? (process.env.STRIPE_PUBLISHABLE_KEY_LIVE ?? '')
    : (process.env.STRIPE_PUBLISHABLE_KEY_SANDBOX ?? '');
}

/** Returns the mode-appropriate webhook secret for the platform (donor flows). */
export async function getStripeWebhookSecret() {
  const mode = await loadMode();
  return mode === 'live'
    ? (process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? '')
    : (process.env.STRIPE_WEBHOOK_SECRET_SANDBOX ?? '');
}

/** Returns the mode-appropriate Stripe Connect OAuth client ID. */
export async function getStripeConnectClientId() {
  // Connect client ID is the same for both modes in most setups
  return process.env.STRIPE_CONNECT_CLIENT_ID ?? '';
}

/** Returns the mode-appropriate Stripe Connect webhook secret (payment provider).
 *  DB takes precedence — the register-stripe-webhook route writes the fresh secret
 *  there after creating/recreating the endpoint. ENV is the fallback for manual setups. */
export async function getStripeConnectWebhookSecret() {
  const mode = await loadMode();
  const dbKey = mode === 'live'
    ? 'stripe_connect_webhook_secret_live'
    : 'stripe_connect_webhook_secret_sandbox';

  try {
    const row = await prisma.appSetting.findUnique({ where: { key: dbKey } });
    if (row?.value) {
      console.log(`[getStripeConnectWebhookSecret] mode=${mode} source=DB prefix=${row.value.slice(0, 14)}...`);
      return row.value;
    }
  } catch {}

  const envSecret = mode === 'live'
    ? (process.env.STRIPE_CONNECT_WEBHOOK_SECRET_LIVE ?? '')
    : (process.env.STRIPE_CONNECT_WEBHOOK_SECRET_SANDBOX ?? '');
  console.log(`[getStripeConnectWebhookSecret] mode=${mode} source=ENV prefix=${envSecret ? envSecret.slice(0, 14) + '...' : 'MISSING'}`);
  return envSecret;
}

// ─── Plaid ────────────────────────────────────────────────────────────────────

/** Returns Plaid credentials and environment for the current mode. */
export async function getPlaidConfig() {
  const mode = await loadMode();
  return {
    clientId: process.env.PLAID_CLIENT_ID ?? '',
    secretKey: mode === 'live'
      ? (process.env.PLAID_SECRET_KEY_LIVE ?? '')
      : (process.env.PLAID_SECRET_KEY_SANDBOX ?? ''),
    env: mode === 'live' ? 'production' : 'sandbox',
    baseUrl: mode === 'live'
      ? 'https://production.plaid.com'
      : 'https://sandbox.plaid.com',
  };
}
