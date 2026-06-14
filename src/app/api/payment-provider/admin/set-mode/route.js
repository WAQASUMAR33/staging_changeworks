export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { clearPaymentModeCache } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

/**
 * POST /api/payment-provider/admin/set-mode
 * Body: { mode: "live" | "sandbox" }
 * Switches payment mode and syncs all ghlStripeConnection rows to the new mode.
 */
export async function POST(request) {
  let body = {};
  try { body = await request.json(); } catch {}

  const mode = body.mode;
  if (!['live', 'sandbox'].includes(mode)) {
    return NextResponse.json({ error: 'mode must be "live" or "sandbox"' }, { status: 400 });
  }

  const isLive  = mode === 'live';
  const pubKey  = isLive
    ? (process.env.STRIPE_PUBLISHABLE_KEY_LIVE    ?? '')
    : (process.env.STRIPE_PUBLISHABLE_KEY_SANDBOX ?? '');

  if (!pubKey) {
    return NextResponse.json({ error: `${isLive ? 'STRIPE_PUBLISHABLE_KEY_LIVE' : 'STRIPE_PUBLISHABLE_KEY_SANDBOX'} is not set in env vars` }, { status: 500 });
  }

  // Update AppSetting
  await prisma.appSetting.upsert({
    where:  { key: 'payment_mode' },
    update: { value: mode },
    create: { key: 'payment_mode', value: mode, label: 'Payment Mode', description: 'sandbox or live' },
  });

  // Sync all ghlStripeConnection rows to match the new mode
  const { count } = await prisma.ghlStripeConnection.updateMany({
    data: { livemode: isLive, publishableKey: pubKey },
  });

  // Clear in-memory cache so next request picks up immediately
  clearPaymentModeCache();

  console.log(`[set-mode] ✅ Switched to ${mode} | synced ${count} ghlStripeConnection rows | pubKey=${pubKey.slice(0, 12)}...`);

  return NextResponse.json({
    success: true,
    mode,
    syncedRows: count,
    pubKeyPrefix: pubKey.slice(0, 12) + '...',
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
