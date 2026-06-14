export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { corsHeaders } from '@/app/lib/cors';

/**
 * GET /api/payment-provider/admin/debug-env
 * Shows the active env var values for GHL and Stripe — for debugging only.
 * Safe: secrets are masked, only prefixes shown.
 */
export async function GET() {
  const mask = (v, show = 12) => v ? `${v.slice(0, show)}... (len=${v.length})` : 'MISSING';

  return NextResponse.json({
    ghl: {
      GHL_APP_CLIENT_ID:       process.env.GHL_APP_CLIENT_ID       ?? 'MISSING',
      GHL_APP_CLIENT_SECRET:   mask(process.env.GHL_APP_CLIENT_SECRET, 8),
      GHL_REDIRECT_URI:        process.env.GHL_REDIRECT_URI         ?? 'MISSING',
      GHL_VERSION_ID:          process.env.GHL_VERSION_ID           ?? 'MISSING',
      GHL_WEBHOOK_SECRET:      mask(process.env.GHL_WEBHOOK_SECRET, 8),
      GHL_API_BASE:            process.env.GHL_API_BASE             ?? 'MISSING',
    },
    stripe: {
      STRIPE_CONNECT_CLIENT_ID:    process.env.STRIPE_CONNECT_CLIENT_ID    ?? 'MISSING',
      STRIPE_CONNECT_REDIRECT_URI: process.env.STRIPE_CONNECT_REDIRECT_URI ?? 'MISSING',
      STRIPE_SECRET_KEY_LIVE:      mask(process.env.STRIPE_SECRET_KEY_LIVE, 12),
      STRIPE_SECRET_KEY_SANDBOX:   mask(process.env.STRIPE_SECRET_KEY_SANDBOX, 12),
      STRIPE_PUBLISHABLE_KEY_LIVE:    process.env.STRIPE_PUBLISHABLE_KEY_LIVE    ? process.env.STRIPE_PUBLISHABLE_KEY_LIVE.slice(0, 20) + '...' : 'MISSING',
      STRIPE_PUBLISHABLE_KEY_SANDBOX: process.env.STRIPE_PUBLISHABLE_KEY_SANDBOX ? process.env.STRIPE_PUBLISHABLE_KEY_SANDBOX.slice(0, 20) + '...' : 'MISSING',
      STRIPE_CONNECT_WEBHOOK_SECRET_LIVE:    mask(process.env.STRIPE_CONNECT_WEBHOOK_SECRET_LIVE, 14),
      STRIPE_CONNECT_WEBHOOK_SECRET_SANDBOX: mask(process.env.STRIPE_CONNECT_WEBHOOK_SECRET_SANDBOX, 14),
    },
    app: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? 'MISSING',
    },
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
