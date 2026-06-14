export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { buildGHLOAuthUrl } from '@/app/lib/payment-provider/ghl';
import { generateStateToken } from '@/app/lib/payment-provider/crypto';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId') ?? '';
  const state = generateStateToken({ locationId, source: 'ghl-oauth' });
  const authUrl = buildGHLOAuthUrl(state);
  console.log(`[GHL Auth] redirecting to OAuth | client_id=${process.env.GHL_APP_CLIENT_ID ?? 'MISSING'} | version_id=${process.env.GHL_VERSION_ID ?? 'MISSING'} | redirect_uri=${process.env.GHL_REDIRECT_URI ?? 'MISSING'}`);
  return NextResponse.redirect(authUrl);
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
