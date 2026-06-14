/**
 * lib/payment-provider/tokenStore.js
 * Database-backed token store using the changeworks Prisma singleton.
 */

import { prisma } from '@/app/lib/prisma';

// ─── GHL Tokens ──────────────────────────────────────────────────────────────

export async function saveGHLTokens(locationId, tokens) {
  await prisma.ghlConnection.upsert({
    where:  { locationId },
    create: {
      locationId,
      companyId:    tokens.companyId    ?? null,
      userId:       tokens.userId       ?? null,
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    new Date(tokens.expires_at),
    },
    update: {
      companyId:    tokens.companyId    ?? undefined,
      userId:       tokens.userId       ?? undefined,
      accessToken:  tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt:    new Date(tokens.expires_at),
    },
  });
}

export async function getGHLTokens(locationId) {
  const row = await prisma.ghlConnection.findUnique({ where: { locationId } });
  if (!row) return null;
  return {
    access_token:  row.accessToken,
    refresh_token: row.refreshToken,
    expires_at:    row.expiresAt.getTime(),
    companyId:     row.companyId,
    userId:        row.userId,
    locationId:    row.locationId,
  };
}

export async function listGHLLocations() {
  const rows = await prisma.ghlConnection.findMany({ select: { locationId: true } });
  return rows.map((r) => r.locationId);
}

// ─── Stripe Connect Accounts ─────────────────────────────────────────────────

export async function saveStripeAccount(locationId, data) {
  if (!data) {
    await prisma.ghlStripeConnection.deleteMany({ where: { locationId } });
    return;
  }
  // Ensure parent GhlConnection row exists (FK required by ghl_stripe_connections)
  await prisma.ghlConnection.upsert({
    where:  { locationId },
    create: { locationId, accessToken: 'auto-connect-stub', refreshToken: null, expiresAt: new Date(Date.now() + 100 * 365 * 24 * 3600 * 1000) },
    update: {},
  });
  // Delete ALL conflicting rows first (same stripeAccountId OR same locationId)
  // to avoid unique constraint violations from concurrent requests or stale data.
  await prisma.ghlStripeConnection.deleteMany({
    where: {
      OR: [
        { stripeAccountId: data.stripeAccountId },
        { locationId },
      ],
    },
  });
  // Always INSERT fresh — no upsert race condition possible after the delete above.
  await prisma.ghlStripeConnection.create({
    data: {
      locationId,
      stripeAccountId: data.stripeAccountId,
      accessToken:     data.accessToken,
      refreshToken:    data.refreshToken  ?? null,
      publishableKey:  data.publishableKey,
      livemode:        data.livemode      ?? false,
      tokenType:       data.tokenType     ?? null,
      scope:           data.scope         ?? null,
    },
  });
}

export async function getStripeAccount(locationId) {
  const row = await prisma.ghlStripeConnection.findUnique({ where: { locationId } });
  if (!row) return null;
  return {
    stripeAccountId: row.stripeAccountId,
    accessToken:     row.accessToken,
    refreshToken:    row.refreshToken,
    publishableKey:  row.publishableKey,
    livemode:        row.livemode,
    tokenType:       row.tokenType,
    scope:           row.scope,
  };
}

export async function getLocationByStripeAccount(stripeAccountId) {
  const row = await prisma.ghlStripeConnection.findUnique({
    where:  { stripeAccountId },
    select: { locationId: true },
  });
  return row?.locationId ?? null;
}

// ─── Payment Events ───────────────────────────────────────────────────────────

export async function upsertPaymentEvent(data) {
  return prisma.ghlPaymentEvent.upsert({
    where:  { paymentIntentId: data.paymentIntentId },
    create: {
      locationId:      data.locationId,
      stripeAccountId: data.stripeAccountId,
      paymentIntentId: data.paymentIntentId,
      entityId:        data.entityId        ?? null,
      entityType:      data.entityType      ?? null,
      amount:          data.amount,
      currency:        data.currency        ?? 'usd',
      status:          data.status,
      failureReason:   data.failureReason   ?? null,
      refundedAmount:  data.refundedAmount  ?? 0,
      customerName:    data.customerName    ?? null,
      customerEmail:   data.customerEmail   ?? null,
      customerPhone:   data.customerPhone   ?? null,
      metadata:        data.metadata ? JSON.stringify(data.metadata) : null,
    },
    update: {
      status:         data.status,
      failureReason:  data.failureReason  ?? undefined,
      refundedAmount: data.refundedAmount ?? undefined,
      ...(data.customerName  ? { customerName:  data.customerName  } : {}),
      ...(data.customerEmail ? { customerEmail: data.customerEmail } : {}),
      ...(data.customerPhone ? { customerPhone: data.customerPhone } : {}),
    },
  });
}

export async function getPaymentEventByEntityId(locationId, entityId) {
  return prisma.ghlPaymentEvent.findFirst({
    where:   { locationId, entityId },
    orderBy: { createdAt: 'asc' },
  });
}

export async function getPaymentEventByIntentId(paymentIntentId) {
  return prisma.ghlPaymentEvent.findUnique({ where: { paymentIntentId } });
}

export async function listPaymentEvents(locationId, { limit = 50, offset = 0, status } = {}) {
  return prisma.ghlPaymentEvent.findMany({
    where:   { locationId, ...(status ? { status } : {}) },
    orderBy: { createdAt: 'desc' },
    take:    limit,
    skip:    offset,
  });
}

// ─── GHL ↔ Stripe Product Sync Map ───────────────────────────────────────────

export async function saveProductSync(locationId, ghlProductId, stripeProductId, stripePriceId) {
  await prisma.ghlProductSync.upsert({
    where:  { locationId_ghlProductId: { locationId, ghlProductId } },
    create: { locationId, ghlProductId, stripeProductId, stripePriceId: stripePriceId ?? null },
    update: { stripeProductId, stripePriceId: stripePriceId ?? undefined },
  });
}

export async function getProductSync(locationId, ghlProductId) {
  return prisma.ghlProductSync.findUnique({
    where: { locationId_ghlProductId: { locationId, ghlProductId } },
  });
}

export async function deleteProductSync(locationId, ghlProductId) {
  await prisma.ghlProductSync.deleteMany({ where: { locationId, ghlProductId } });
}

export async function savePriceSync(locationId, ghlPriceId, ghlProductId, stripePriceId) {
  await prisma.ghlPriceSync.upsert({
    where:  { locationId_ghlPriceId: { locationId, ghlPriceId } },
    create: { locationId, ghlPriceId, ghlProductId, stripePriceId },
    update: { stripePriceId },
  });
}

export async function getPriceSync(locationId, ghlPriceId) {
  return prisma.ghlPriceSync.findUnique({
    where: { locationId_ghlPriceId: { locationId, ghlPriceId } },
  });
}

export async function deletePriceSync(locationId, ghlPriceId) {
  await prisma.ghlPriceSync.deleteMany({ where: { locationId, ghlPriceId } });
}

// ─── Webhook Idempotency ──────────────────────────────────────────────────────

export async function isWebhookProcessed(eventId) {
  const row = await prisma.ghlWebhookLog.findUnique({
    where:  { eventId },
    select: { status: true },
  });
  return row?.status === 'PROCESSED';
}

export async function createWebhookLog(data) {
  const row = {
    source:     data.source,
    eventId:    data.eventId,
    eventType:  data.eventType,
    locationId: data.locationId ?? null,
    payload:    typeof data.payload === 'string' ? data.payload : JSON.stringify(data.payload),
    status:     'PENDING',
  };
  try {
    return await prisma.ghlWebhookLog.create({ data: row });
  } catch (err) {
    if (err.code === 'P2003' && row.locationId) {
      console.warn(`[tokenStore] createWebhookLog FK error for locationId=${row.locationId} — retrying with null`);
      return prisma.ghlWebhookLog.create({ data: { ...row, locationId: null } });
    }
    throw err;
  }
}

export async function updateWebhookLog(eventId, status, error) {
  try {
    await prisma.ghlWebhookLog.update({
      where: { eventId },
      data:  { status, error: error ?? null, processedAt: new Date() },
    });
  } catch (err) {
    if (err.code !== 'P2025') throw err;
    console.warn(`[tokenStore] updateWebhookLog: no log found for eventId=${eventId} (non-fatal)`);
  }
}
