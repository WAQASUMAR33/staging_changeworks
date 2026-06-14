export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { getPaymentMode, getStripePublishableKey, getPlaidConfig } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

/**
 * GET /api/config/payment-mode
 * Public endpoint — returns the current mode and client-safe keys.
 * Used by client components (StripeProvider, PlaidIntegration) to load the right keys at runtime.
 */
export async function GET() {
  const [mode, stripePublishableKey, plaid] = await Promise.all([
    getPaymentMode(),
    getStripePublishableKey(),
    getPlaidConfig(),
  ]);

  return NextResponse.json({
    mode,                                   // 'sandbox' | 'live'
    stripePublishableKey,                   // pk_test_... or pk_live_...
    plaidEnv: plaid.env,                    // 'sandbox' | 'production'
  });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
