import { NextResponse } from 'next/server';
import { getPlaidConfig } from '@/app/lib/payment-mode';
import { createStripeClient } from '@/app/lib/payment-mode';
import { z } from 'zod';
import { prisma } from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { corsHeaders } from '@/app/lib/cors';


function getPlaidBaseUrl(env) {
  switch (env) {
    case 'production': return 'https://production.plaid.com';
    case 'development': return 'https://development.plaid.com';
    default: return 'https://sandbox.plaid.com';
  }
}



const schema = z.object({
  account_id:          z.string().min(1, 'account_id is required'),  // Plaid account_id (spending source)
  plaid_connection_id: z.number().int().positive(),
  start_date:          z.string().min(1),
  end_date:            z.string().min(1),
});

// Round-up calculation: e.g. $4.30 → $0.70
function calcRoundUp(amount) {
  if (!amount || amount <= 0) return 0;
  const cents = Math.round(amount * 100) % 100;
  return cents === 0 ? 0 : parseFloat(((100 - cents) / 100).toFixed(2));
}

// Fetch transactions from Plaid (spending source — used only for round-up calculation)
async function fetchTransactions(accessToken, startDate, endDate, plaid) {
  const response = await fetch(`${plaid.baseUrl}/transactions/get`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PLAID-CLIENT-ID': plaid.clientId,
      'PLAID-SECRET': plaid.secretKey,
    },
    body: JSON.stringify({
      client_id: plaid.clientId,
      secret: plaid.secretKey,
      access_token: accessToken,
      start_date: startDate,
      end_date: endDate,
      options: { count: 500, offset: 0 },
    }),
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(err?.error_message || 'Failed to fetch Plaid transactions');
  }

  const data = await response.json();
  return data.transactions || [];
}

export async function POST(req) {
  const plaid = await getPlaidConfig();
  try {
    const stripe = await createStripeClient();
    if (!stripe) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 });
    }

    // ── Auth ──────────────────────────────────────────────────────────────────
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'No token provided' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(authHeader.substring(7), process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const donorId = decoded.id;
    const body    = await req.json();
    const { account_id, plaid_connection_id, start_date, end_date } = schema.parse(body);

    // ── Load PlaidConnection (spending source) with org's Stripe sub-account ──
    const connection = await prisma.plaidConnection.findFirst({
      where: { id: plaid_connection_id, donor_id: donorId },
      include: {
        donor:        { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true, email: true, stripeAccountId: true } },
      },
    });

    if (!connection) {
      return NextResponse.json({ success: false, error: 'Plaid connection not found' }, { status: 404 });
    }

    if (!connection.organization.stripeAccountId) {
      return NextResponse.json(
        { success: false, error: 'Organization Stripe sub-account not connected' },
        { status: 400 }
      );
    }

    const orgStripeAccountId = connection.organization.stripeAccountId.trim();

    // ── Load donor's saved card for this org's connected account ─────────────
    const pmRows = await prisma.$queryRaw`
      SELECT stripe_customer_id, stripe_payment_method_id, label
      FROM donor_payment_methods
      WHERE donor_id       = ${donorId}
        AND organization_id = ${connection.organization.id}
        AND status         = 'active'
      ORDER BY is_default DESC, created_at DESC
      LIMIT 1
    `;

    if (!pmRows[0]) {
      return NextResponse.json(
        {
          success: false,
          error: 'No funding card found for this organization. Please add a card to your account.',
          error_code: 'MISSING_PAYMENT_METHOD',
        },
        { status: 400 }
      );
    }

    const { stripe_customer_id, stripe_payment_method_id, label: cardLabel } = pmRows[0];

    // ── Step 1: Calculate round-up total from Plaid transactions ─────────────
    const transactions = await fetchTransactions(connection.access_token, start_date, end_date, plaid);
    const purchases    = transactions.filter((t) => t.amount > 0); // debits only
    const totalRoundUpDollars = parseFloat(
      purchases.reduce((sum, t) => sum + calcRoundUp(t.amount), 0).toFixed(2)
    );

    // Load minimum threshold from DB (admin-configurable); fallback to $1.00
    let MINIMUM_CHARGE_DOLLARS = 1.00;
    try {
      const thresholdSetting = await prisma.appSetting.findUnique({
        where: { key: 'roundup_minimum_threshold' },
      });
      if (thresholdSetting) {
        const parsed = parseFloat(thresholdSetting.value);
        if (!isNaN(parsed) && parsed >= 1.00) MINIMUM_CHARGE_DOLLARS = parsed;
      }
    } catch {
      // Non-fatal: use default if DB lookup fails
    }

    if (totalRoundUpDollars <= 0) {
      return NextResponse.json(
        { success: false, error: 'No round-up amount to charge for this period' },
        { status: 400 }
      );
    }

    if (totalRoundUpDollars < MINIMUM_CHARGE_DOLLARS) {
      return NextResponse.json(
        {
          success: false,
          error: `Round-up total $${totalRoundUpDollars} is below the $${MINIMUM_CHARGE_DOLLARS.toFixed(2)} minimum. Amount will accumulate until next period.`,
          accumulated_amount: totalRoundUpDollars,
          minimum_required:   MINIMUM_CHARGE_DOLLARS,
          below_minimum:      true,
        },
        { status: 400 }
      );
    }

    const amountInCents = Math.round(totalRoundUpDollars * 100);
    console.log(`💰 Round-up: $${totalRoundUpDollars} (${amountInCents}¢) — card: ${cardLabel} → org ${orgStripeAccountId}`);

    // ── Step 2: Platform fee calculation ─────────────────────────────────────
    const SPECIAL_ORG_EMAIL    = 'frankie@vallartacares.com';
    const isSpecialOrg         = connection.organization.email?.toLowerCase() === SPECIAL_ORG_EMAIL.toLowerCase();
    // Card fees: ~2.9% + $0.30; budget 10% and net off the Stripe fee estimate
    const platformBudget       = Math.round(amountInCents * 0.10);
    const estimatedStripeFee   = Math.round(amountInCents * 0.029) + 30;
    const applicationFeeAmount = isSpecialOrg ? 0 : Math.max(0, platformBudget - estimatedStripeFee);

    // ── Step 3: Direct charge on the org's connected account ─────────────────
    // The donor's Stripe customer and card source both live on the connected
    // account, so we charge directly there and collect a platform fee.
    let charge;
    try {
      charge = await stripe.charges.create(
        {
          amount:                 amountInCents,
          currency:               'usd',
          customer:               stripe_customer_id,  // customer on connected account
          application_fee_amount: applicationFeeAmount,
          receipt_email:          connection.donor.email,
          description:            `Monthly round-up donation (${start_date} → ${end_date}), ${purchases.length} transactions`,
          metadata: {
            donor_id:            donorId.toString(),
            organization_id:     connection.organization.id.toString(),
            plaid_connection_id: plaid_connection_id.toString(),
            plaid_account_id:    account_id,
            card_label:          cardLabel,
            start_date,
            end_date,
            transaction_count:   purchases.length.toString(),
            round_up_dollars:    totalRoundUpDollars.toString(),
            transaction_type:    'round_up_card',
          },
        },
        { stripeAccount: orgStripeAccountId }  // charge runs on connected account
      );
      console.log(`✅ Card charge ${charge.id} — status: ${charge.status} on ${orgStripeAccountId}`);
    } catch (stripeErr) {
      console.error('Stripe card charge error:', stripeErr.message);
      return NextResponse.json(
        { success: false, error: 'Card charge failed', details: stripeErr.message },
        { status: 400 }
      );
    }

    // ── Step 4: Record in DB ──────────────────────────────────────────────────
    const trxRecord = await prisma.saveTrRecord.create({
      data: {
        trx_id:              `card_${charge.id}_${Date.now()}`,
        trx_date:            new Date(),
        trx_amount:          totalRoundUpDollars,
        trx_method:          'card',
        trx_donor_id:        donorId,
        trx_organization_id: connection.organization.id,
        trx_details: JSON.stringify({
          charge_id:          charge.id,
          stripe_status:      charge.status,
          org_stripe_account: orgStripeAccountId,
          plaid_account_id:   account_id,
          plaid_connection_id,
          card_label:         cardLabel,
          start_date,
          end_date,
          transaction_count:  purchases.length,
          round_up_dollars:   totalRoundUpDollars,
          platform_fee_cents: applicationFeeAmount,
          transaction_type:   'round_up_card',
        }),
        pay_status: charge.status === 'succeeded' ? 'completed' : 'pending',
      },
    });

    return NextResponse.json({
      success:           true,
      charge_id:         charge.id,
      status:            charge.status,
      amount_dollars:    totalRoundUpDollars,
      transaction_count: purchases.length,
      transaction_id:    trxRecord.id,
      org_stripe_account: orgStripeAccountId,
      message:           charge.status === 'succeeded' ? 'Payment completed' : 'Payment initiated',
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('charge-roundup error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
