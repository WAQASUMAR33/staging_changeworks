export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { listGHLLocations, getStripeAccount } from '@/app/lib/payment-provider/tokenStore';
import { corsHeaders } from '@/app/lib/cors';

export async function GET() {
  const locationIds = await listGHLLocations();
  const locations = await Promise.all(
    locationIds.map(async (id) => {
      const stripe = await getStripeAccount(id);
      return { locationId: id, ghlConnected: true, stripeConnected: !!stripe, stripeAccountId: stripe?.stripeAccountId ?? null, livemode: stripe?.livemode ?? false };
    })
  );
  return NextResponse.json({ locations });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
