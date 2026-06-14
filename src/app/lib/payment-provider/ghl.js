/**
 * lib/payment-provider/ghl.js
 * GoHighLevel API v2 helpers for the payment provider integration.
 */

import axios from 'axios';
import { saveGHLTokens, getGHLTokens, getStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { prisma } from '@/app/lib/prisma';

const GHL_API_BASE   = process.env.GHL_API_BASE   || 'https://services.leadconnectorhq.com';
const GHL_AUTH_BASE  = 'https://marketplace.gohighlevel.com/oauth';
const GHL_TOKEN_BASE = 'https://services.leadconnectorhq.com/oauth';

// ─── OAuth ────────────────────────────────────────────────────────────────────

export function buildGHLOAuthUrl(state) {
  const clientId    = process.env.GHL_APP_CLIENT_ID;
  const redirectUri = process.env.GHL_REDIRECT_URI;
  const versionId   = process.env.GHL_VERSION_ID;
  console.log(`[buildGHLOAuthUrl] client_id=${clientId ?? 'MISSING'} | redirect_uri=${redirectUri ?? 'MISSING'} | version_id=${versionId ?? 'not set'}`);
  const params = new URLSearchParams({
    response_type: 'code',
    redirect_uri:  redirectUri,
    client_id:     clientId,
    scope: [
      'payments/integration.write',
      'payments/integration.readonly',
      'payments/custom-provider.write',
      'payments/custom-provider.readonly',
      'payments/orders.write',
      'payments/orders.readonly',
      'payments/orders.collectPayment',
      'payments/transactions.readonly',
      'payments/subscriptions.readonly',
      'products.readonly',
      'products.write',
      'products/prices.readonly',
      'products/prices.write',
      'products/collection.readonly',
      'products/collection.write',
    ].join(' '),
    state,
    ...(process.env.GHL_VERSION_ID ? { version_id: process.env.GHL_VERSION_ID } : {}),
  });
  return `${GHL_AUTH_BASE}/chooselocation?${params.toString()}`;
}

export async function exchangeGHLCode(code) {
  const clientId     = process.env.GHL_APP_CLIENT_ID;
  const clientSecret = process.env.GHL_APP_CLIENT_SECRET;
  const redirectUri  = process.env.GHL_REDIRECT_URI;
  console.log(`[exchangeGHLCode] ▶ client_id=${clientId ?? 'MISSING'} | secret=${clientSecret ? clientSecret.slice(0,8)+'...' : 'MISSING'} | redirect_uri=${redirectUri ?? 'MISSING'} | code=${code ? code.slice(0,12)+'...' : 'MISSING'}`);
  const params = new URLSearchParams({
    client_id:     clientId,
    client_secret: clientSecret,
    grant_type:    'authorization_code',
    code,
    redirect_uri:  redirectUri,
    user_type:     'Location',
  });
  try {
    const { data } = await axios.post(`${GHL_TOKEN_BASE}/token`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log(`[exchangeGHLCode] ✅ success | locationId=${data.locationId} | token=${data.access_token ? data.access_token.slice(0,12)+'...' : 'MISSING'}`);
    return data;
  } catch (err) {
    const status  = err.response?.status;
    const errData = err.response?.data;
    console.error(`[exchangeGHLCode] ❌ FAILED | status=${status} | response=${JSON.stringify(errData ?? err.message)}`);
    throw err;
  }
}

export async function refreshGHLToken(locationId) {
  console.log(`[refreshGHLToken] ▶ locationId=${locationId}`);
  const stored = await getGHLTokens(locationId);
  if (!stored) throw new Error(`No tokens stored for location: ${locationId}`);
  const params = new URLSearchParams({
    client_id:     process.env.GHL_APP_CLIENT_ID,
    client_secret: process.env.GHL_APP_CLIENT_SECRET,
    grant_type:    'refresh_token',
    refresh_token: stored.refresh_token,
    user_type:     'Location',
  });
  try {
    const { data } = await axios.post(`${GHL_TOKEN_BASE}/token`, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const updated = {
      ...stored,
      access_token:  data.access_token,
      refresh_token: data.refresh_token || stored.refresh_token,
      expires_at:    Date.now() + data.expires_in * 1000,
    };
    await saveGHLTokens(locationId, updated);
    console.log(`[refreshGHLToken] ✅ refreshed for ${locationId}`);
    return updated;
  } catch (err) {
    const status  = err.response?.status;
    const errData = err.response?.data;
    console.error(`[refreshGHLToken] ❌ FAILED | status=${status} | response=${JSON.stringify(errData ?? err.message)}`);
    // Refresh token is dead — clear stale connection so caller gets a clean error
    if (status === 401 || status === 400) {
      // Delete children first to satisfy FK constraints before removing the parent
      await prisma.ghlStripeConnection.deleteMany({ where: { locationId } });
      await prisma.ghlPaymentEvent.deleteMany({ where: { locationId } });
      await prisma.ghlWebhookLog.deleteMany({ where: { locationId } });
      await prisma.ghlConnection.deleteMany({ where: { locationId } });
      console.error(`[refreshGHLToken] Cleared stale GHL connection for ${locationId} — reconnect GHL OAuth`);
    }
    throw new Error(`GHL token refresh failed (${status}) — reconnect GHL OAuth for location ${locationId}`);
  }
}

// ─── Authenticated API Client ─────────────────────────────────────────────────

export async function getValidAccessToken(locationId) {
  let tokens = await getGHLTokens(locationId);
  if (!tokens) {
    console.error(`[getValidAccessToken] ❌ No tokens stored for locationId=${locationId}`);
    throw new Error(`Location ${locationId} not connected.`);
  }
  if (tokens.access_token === 'auto-connect-stub') {
    console.error(`[getValidAccessToken] ❌ Stub token detected for locationId=${locationId} — GHL OAuth not completed`);
    throw new Error(`GHL OAuth not completed for this location — connect GHL first`);
  }
  const expiresIn = Math.round((tokens.expires_at - Date.now()) / 1000);
  console.log(`[getValidAccessToken] locationId=${locationId} | expiresIn=${expiresIn}s | needsRefresh=${tokens.expires_at < Date.now() + 5 * 60 * 1000}`);
  if (tokens.expires_at < Date.now() + 5 * 60 * 1000) {
    tokens = await refreshGHLToken(locationId);
  }
  return tokens.access_token;
}

export async function ghlClient(locationId) {
  const accessToken = await getValidAccessToken(locationId);
  return axios.create({
    baseURL: GHL_API_BASE,
    headers: {
      Authorization:  `Bearer ${accessToken}`,
      Version:        '2021-07-28',
      'Content-Type': 'application/json',
    },
  });
}

// ─── Location ─────────────────────────────────────────────────────────────────

export async function getLocation(locationId) {
  const client = await ghlClient(locationId);
  const { data } = await client.get(`/locations/${locationId}`);
  return data.location;
}

// ─── Contacts ─────────────────────────────────────────────────────────────────

export async function getContactByEmail(locationId, email) {
  try {
    const client = await ghlClient(locationId);
    const { data } = await client.get(`/contacts/search/duplicate`, {
      params: { locationId, email },
    });
    const contact = data?.contact ?? data?.contacts?.[0] ?? null;
    return contact;
  } catch (err) {
    console.warn(`[GHL] getContactByEmail failed for ${email}:`, err.response?.status ?? err.message);
    return null;
  }
}

// ─── Payments ─────────────────────────────────────────────────────────────────

export async function getTransaction(locationId, transactionId) {
  try {
    const client = await ghlClient(locationId);
    const { data } = await client.get(
      `/payments/transactions/${transactionId}?altId=${locationId}&altType=location`
    );
    return data?.transaction ?? data ?? null;
  } catch (err) {
    console.warn(`[GHL] getTransaction failed for ${transactionId}:`, err.response?.status ?? err.message);
    return null;
  }
}

// ─── Payment Provider ─────────────────────────────────────────────────────────

export async function listPaymentIntegrations(locationId) {
  const client = await ghlClient(locationId);
  const { data } = await client.get(`/payments/integrations/provider/whitelabel?locationId=${locationId}`);
  return data;
}

export async function createGHLPaymentProvider(locationId) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  const client = await ghlClient(locationId);
  try {
    const { data } = await client.post(`/payments/custom-provider/provider?locationId=${locationId}`, {
      name:        'ChangeWorks',
      description: 'Accept payments via Stripe Connect',
      paymentsUrl: `${appUrl}/payment-provider/checkout`,
      queryUrl:    `${appUrl}/api/payment-provider/payments/status`,
      imageUrl:    'https://upload.wikimedia.org/wikipedia/commons/b/ba/Stripe_Logo%2C_revised_2016.svg',
    });
    return data;
  } catch (err) {
    // Provider already exists — not an error, proceed to connect step
    if (err.response?.status === 409 || err.response?.status === 422) {
      console.log(`[GHL] Provider already exists for ${locationId}, skipping create.`);
      return { alreadyExists: true };
    }
    throw err;
  }
}

export async function connectGHLPaymentProvider(locationId) {
  const providerData = await createGHLPaymentProvider(locationId);
  const apiKey       = process.env.GHL_APP_CLIENT_SECRET;

  // Use the mode-appropriate publishable keys (STRIPE_PUBLISHABLE_KEY is not used).
  const livePubKey  = process.env.STRIPE_PUBLISHABLE_KEY_LIVE     || '';
  const testPubKey  = process.env.STRIPE_PUBLISHABLE_KEY_SANDBOX  || '';

  console.log(`[GHL] connectGHLPaymentProvider for ${locationId}: apiKey=${apiKey ? apiKey.slice(0,8)+'...' : 'MISSING'} | livePubKey=${livePubKey ? livePubKey.slice(0,12)+'...' : 'EMPTY'} | testPubKey=${testPubKey ? testPubKey.slice(0,12)+'...' : 'EMPTY'}`);

  const client      = await ghlClient(locationId);
  const connectBody = {
    live: { liveMode: true,  apiKey, publishableKey: livePubKey, enabled: true },
    test: { liveMode: false, apiKey, publishableKey: testPubKey, enabled: true },
  };
  try {
    const { data: connectData } = await client.post(`/payments/custom-provider/connect?locationId=${locationId}`, connectBody);
    console.log(`[GHL] ✅ Payment provider connected for location ${locationId}:`, JSON.stringify(connectData));
  } catch (err) {
    const status = err.response?.status;
    const errData = err.response?.data ?? err.message;
    console.error(`[GHL] ❌ connect FAILED for ${locationId}: status=${status} | error=${JSON.stringify(errData)}`);
    // Re-throw so callers can surface the failure
    throw new Error(`GHL connect failed (${status}): ${JSON.stringify(errData)}`);
  }
  return providerData;
}

export async function disconnectGHLPaymentProvider(locationId) {
  const client = await ghlClient(locationId);
  const { data } = await client.delete('/payments/custom-provider/disconnect', { data: { locationId } });
  return data;
}

export async function postPaymentUpdateToGHL(locationId, payload) {
  const accessToken = await getValidAccessToken(locationId);
  const body = {
    event:            'payment.captured',
    chargeId:         payload.chargeId,
    ghlTransactionId: payload.ghlTransactionId,
    chargeSnapshot: { status: 'succeeded', amount: payload.amount, chargeId: payload.chargeId },
    locationId,
    apiKey: process.env.GHL_APP_CLIENT_SECRET,
  };
  const response = await axios.post(
    'https://backend.leadconnectorhq.com/payments/custom-provider/webhook',
    body,
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Version: '2021-07-28' } }
  );
  return response.data;
}

export async function postSubscriptionUpdateToGHL(locationId, payload) {
  const accessToken = await getValidAccessToken(locationId);
  const body = {
    event:               'subscription.updated',
    ghlSubscriptionId:   payload.entityId ?? payload.externalSubscriptionId,
    subscriptionSnapshot: { id: payload.externalSubscriptionId, status: payload.status },
    locationId,
    apiKey: process.env.GHL_APP_CLIENT_SECRET,
  };
  const response = await axios.post(
    'https://backend.leadconnectorhq.com/payments/custom-provider/webhook',
    body,
    { headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', Version: '2021-07-28' } }
  );
  return response.data;
}
