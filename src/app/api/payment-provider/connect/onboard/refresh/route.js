export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createAccountLink } from '@/app/lib/payment-provider/stripe';
import { getStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  const baseUrl    = process.env.NEXT_PUBLIC_APP_URL || '';
  const dashboardUrl = `${baseUrl}/organization/dashboard/payment-provider`;

  if (!locationId) {
    return NextResponse.redirect(`${dashboardUrl}?error=missing_location`);
  }
  const stored = await getStripeAccount(locationId);
  if (!stored) {
    return NextResponse.redirect(`${dashboardUrl}?error=not_connected`);
  }
  const returnUrl  = `${baseUrl}/organization/dashboard/payment-provider?locationId=${locationId}&onboarding=complete`;
  const refreshUrl = `${baseUrl}/api/payment-provider/connect/onboard/refresh?locationId=${locationId}`;
  try {
    const link = await createAccountLink(stored.stripeAccountId, returnUrl, refreshUrl);
    return NextResponse.redirect(link.url);
  } catch (err) {
    console.error('[onboard/refresh]', err.message);
    return NextResponse.redirect(`${dashboardUrl}?error=onboard_refresh_failed`);
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
