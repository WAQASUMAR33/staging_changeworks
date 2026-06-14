export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

/**
 * DELETE /api/payment-provider/admin/reset-ghl
 * Removes all GHL OAuth connections and their linked Stripe accounts.
 * Pass ?locationId=xxx to remove a single location, or omit to remove all.
 */
export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId') ?? null;

  try {
    const where = locationId ? { where: { locationId } } : {};
    const whereOpt = locationId ? { where: { locationId } } : {};

    // Must delete children before parent due to FK constraints on GhlConnection.locationId
    const [paymentEvents, webhookLogs, stripe] = await Promise.all([
      prisma.ghlPaymentEvent.deleteMany(whereOpt),
      prisma.ghlWebhookLog.deleteMany(whereOpt),
      prisma.ghlStripeConnection.deleteMany(whereOpt),
    ]);
    const ghl = await prisma.ghlConnection.deleteMany(where);

    const summary = { success: true, ghlRows: ghl.count, stripeRows: stripe.count, paymentEventRows: paymentEvents.count, webhookLogRows: webhookLogs.count, ...(locationId ? { locationId } : {}) };
    console.log(`[reset-ghl] Removed | ${JSON.stringify(summary)}`);
    return NextResponse.json(summary);
  } catch (err) {
    console.error('[reset-ghl] Error:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
