export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { createStripeClient, getPaymentMode } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

/**
 * GET /api/admin/stripe-transactions
 * Fetches live Stripe payment intents across ALL connected org accounts.
 * Query params:
 *   limit        – per-org page size (default 100, max 100)
 *   startingAfter – orgId:cursor  e.g. "5:pi_xxx" for pagination per org
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = Math.min(parseInt(searchParams.get('limit') ?? '100'), 100);

    const mode = await getPaymentMode();
    const stripe = await createStripeClient(mode === 'live');

    // Load all orgs that have a Stripe connected account
    const orgs = await prisma.organization.findMany({
      where: { stripeAccountId: { not: null } },
      select: { id: true, name: true, stripeAccountId: true },
    });

    const val = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

    const allTransactions = [];

    await Promise.all(orgs.map(async (org) => {
      try {
        const piList = await stripe.paymentIntents.list(
          { limit: limitParam, expand: ['data.latest_charge', 'data.latest_charge.customer', 'data.customer'] },
          { stripeAccount: org.stripeAccountId }
        );

        for (const pi of piList.data) {
          if (pi.status === 'canceled') continue;

          const charge         = typeof pi.latest_charge === 'object' && pi.latest_charge ? pi.latest_charge : null;
          const piCustomer     = typeof pi.customer === 'object' && pi.customer ? pi.customer : null;
          const chargeCustomer = typeof charge?.customer === 'object' && charge?.customer ? charge.customer : null;
          const billing        = charge?.billing_details ?? {};

          const donorName =
            val(billing.name)              ||
            val(chargeCustomer?.name)      ||
            val(piCustomer?.name)          ||
            val(pi.metadata?.customerName) ||
            val(pi.metadata?.donor_name)   ||
            null;

          const donorEmail =
            val(billing.email)              ||
            val(chargeCustomer?.email)      ||
            val(piCustomer?.email)          ||
            val(charge?.receipt_email)      ||
            val(pi.receipt_email)           ||
            val(pi.metadata?.customerEmail) ||
            val(pi.metadata?.donor_email)   ||
            '';

          let status = pi.status === 'succeeded'               ? 'completed'
                     : pi.status === 'requires_payment_method' ? 'failed'
                     : pi.status === 'processing'              ? 'pending'
                     : 'pending';

          if (status === 'completed' && charge) {
            if (charge.refunded || charge.amount_refunded > 0) {
              status = 'refunded';
            } else if (charge.reversed) {
              status = 'reversed';
            }
          }

          const paymentMethodType = charge?.payment_method_details?.type ?? 'stripe';
          const paymentMethod = paymentMethodType === 'link' ? 'stripe'
                              : paymentMethodType === 'card' ? 'stripe'
                              : paymentMethodType === 'us_bank_account' ? 'bank_transfer'
                              : 'stripe';

          const transactionType = pi.metadata?.entityType === 'subscription' ? 'subscription'
                                : pi.description?.toLowerCase().includes('subscription') ? 'subscription'
                                : 'donation';

          allTransactions.push({
            id: pi.id,
            trnx_id: charge?.id || pi.id,
            donor: {
              id: donorEmail || pi.id,
              name: donorName,
              email: donorEmail,
            },
            organization: {
              id: org.id,
              name: org.name,
            },
            amount: pi.amount / 100,
            currency: pi.currency?.toUpperCase() ?? 'USD',
            status,
            transaction_type: transactionType,
            payment_method: paymentMethod,
            receipt_url: charge?.receipt_url ?? null,
            created_at: new Date(pi.created * 1000).toISOString(),
            card_brand: charge?.payment_method_details?.card?.brand ?? null,
            card_last4: charge?.payment_method_details?.card?.last4 ?? null,
            stripe_account: org.stripeAccountId,
          });
        }
      } catch (err) {
        console.error(`[admin/stripe-transactions] Failed for org ${org.id} (${org.stripeAccountId}):`, err.message);
      }
    }));

    // Sort newest first across all orgs
    allTransactions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return NextResponse.json({ success: true, transactions: allTransactions, count: allTransactions.length });
  } catch (err) {
    console.error('[admin/stripe-transactions] Error:', err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
