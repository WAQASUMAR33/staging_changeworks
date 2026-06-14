export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';
import { createStripeClient, getPaymentMode } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request, { params }) {
  try {
    const { id } = await params;
    if (!id) return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 });

    const organizationIdInt = parseInt(id);
    if (isNaN(organizationIdInt)) return NextResponse.json({ error: 'Invalid organization ID' }, { status: 400 });

    const organization = await prisma.organization.findUnique({
      where: { id: organizationIdInt },
      select: { stripeAccountId: true, name: true },
    });

    if (!organization) return NextResponse.json({ error: 'Organization not found' }, { status: 404 });

    if (!organization.stripeAccountId) {
      return NextResponse.json({ success: true, transactions: [], organization: { name: organization.name }, message: 'No Stripe account connected' });
    }

    const { searchParams } = new URL(request.url);
    const limitParam  = parseInt(searchParams.get('limit')  ?? '200');
    const startingAfter = searchParams.get('startingAfter') ?? undefined;
    const limit = Math.min(Math.max(limitParam, 1), 200);

    // Use the mode-appropriate platform key so it can access the connected account
    const mode = await getPaymentMode();
    const stripe = await createStripeClient(mode === 'live');

    // Expand both PI-level customer AND charge-level customer.
    // Link (py_) payments attach the customer to the Charge, not always to the PaymentIntent.
    const listParams = {
      limit,
      expand: ['data.latest_charge', 'data.latest_charge.customer', 'data.customer'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    };

    let piList;
    try {
      piList = await stripe.paymentIntents.list(listParams, { stripeAccount: organization.stripeAccountId });
    } catch (stripeErr) {
      console.error('[stripe-transactions] Stripe list error:', stripeErr.message);
      // If live key fails (account in test mode), fall back to sandbox key
      if (mode === 'live' && (stripeErr.message?.includes('No such payment') || stripeErr.code === 'account_invalid' || stripeErr.statusCode === 401)) {
        const sandboxStripe = await createStripeClient(false);
        piList = await sandboxStripe.paymentIntents.list(listParams, { stripeAccount: organization.stripeAccountId });
      } else {
        throw stripeErr;
      }
    }

    const val = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

    const transactions = piList.data
      .filter(pi => pi.status !== 'canceled')
      .map(pi => {
        const charge         = typeof pi.latest_charge === 'object' && pi.latest_charge ? pi.latest_charge : null;
        const piCustomer     = typeof pi.customer === 'object' && pi.customer ? pi.customer : null;
        // For Link (py_) charges, the customer is on the charge, not the PaymentIntent
        const chargeCustomer = typeof charge?.customer === 'object' && charge?.customer ? charge.customer : null;
        const customer       = piCustomer ?? chargeCustomer;
        const billing        = charge?.billing_details ?? {};

        // Priority: billing_details → charge customer (Link) → PI customer → receipt → metadata (least reliable)
        const donorName =
          val(billing.name)               ||
          val(chargeCustomer?.name)       ||
          val(piCustomer?.name)           ||
          val(pi.metadata?.customerName)  ||
          val(pi.metadata?.donor_name)    ||
          null;

        const donorEmail =
          val(billing.email)              ||
          val(chargeCustomer?.email)      ||
          val(piCustomer?.email)          ||
          val(charge?.receipt_email)      ||
          val(pi.receipt_email)           ||
          val(pi.metadata?.customerEmail) ||
          val(pi.metadata?.donor_email)   ||
          null;

        let status = pi.status === 'succeeded'               ? 'completed'
                   : pi.status === 'requires_payment_method' ? 'failed'
                   : pi.status === 'processing'              ? 'pending'
                   : pi.status;

        if (status === 'completed' && charge) {
          if (charge.refunded || charge.amount_refunded > 0) {
            status = 'refunded';
          } else if (charge.reversed) {
            status = 'reversed';
          }
        }

        return {
          id: pi.id,
          transaction_id: charge?.id || pi.id,
          amount: pi.amount / 100,
          currency: pi.currency,
          status,
          transaction_date: new Date(pi.created * 1000).toISOString(),
          description: pi.description || charge?.description || charge?.statement_descriptor || 'Stripe Payment',
          donor: { name: donorName, email: donorEmail },
          method: 'stripe',
          card_brand: charge?.payment_method_details?.card?.brand ?? null,
          card_last4: charge?.payment_method_details?.card?.last4 ?? null,
          receipt_url: charge?.receipt_url ?? null,
          ghl_id: pi.metadata?.ghl_id ?? null,
        };
      });

    return NextResponse.json({
      success: true,
      transactions,
      hasMore: piList.has_more,
      nextCursor: piList.data.length > 0 ? piList.data[piList.data.length - 1].id : null,
      organization: { name: organization.name },
    });

  } catch (error) {
    console.error('[stripe-transactions] Error:', error.message, error.code ?? '');
    return NextResponse.json({ success: false, error: error.message ?? 'Failed to fetch transactions' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
