import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from 'stripe';
import { prisma } from "../../../lib/prisma";

// Initialize Stripe
let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  } else {
    console.warn('STRIPE_SECRET_KEY not set');
  }
} catch (e) {
  console.error('Stripe init error:', e);
}

const schema = z.object({
  payment_intent_id: z.string().min(1),
  payment_method_id: z.string().min(1).optional(),
  donor_id: z.number().int().positive(),
  organization_id: z.number().int().positive(),
  amount_cents: z.number().int().positive().optional(), // optional, for validation/logs
  force_update: z.boolean().optional().default(false),
});

export async function POST(request) {
  try {
    if (!stripe) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { payment_intent_id, payment_method_id, donor_id, organization_id, force_update } = schema.parse(body);

    // Fetch current PI
    let pi = await stripe.paymentIntents.retrieve(payment_intent_id, { expand: ['latest_charge'] });

    // If confirmation is needed and a payment method id is provided, confirm server-side
    if ((pi.status === 'requires_confirmation' || pi.status === 'requires_payment_method') && payment_method_id) {
      pi = await stripe.paymentIntents.confirm(payment_intent_id, {
        payment_method: payment_method_id,
      });
    }

    // If PI requires action (e.g., 3DS), return to client to handle next_action
    if (pi.status === 'requires_action') {
      return NextResponse.json({
        success: true,
        status: 'requires_action',
        client_secret: pi.client_secret,
        next_action: pi.next_action,
        message: 'Additional authentication required. Complete on client with stripe.confirmCardPayment.'
      });
    }

    // Map PI status to DB status
    let dbStatus = 'pending';
    if (pi.status === 'succeeded') dbStatus = 'completed';
    else if (pi.status === 'canceled' || pi.status === 'requires_payment_method') dbStatus = 'failed';

    // Derive receipt URL if available
    const receiptUrl = pi.latest_charge && typeof pi.latest_charge !== 'string' ? pi.latest_charge.receipt_url : undefined;

    // Upsert transaction record by PI id in details to ensure idempotency
    const trxDetails = {
      payment_intent_id: pi.id,
      stripe_status: pi.status,
      receipt_url: receiptUrl,
    };

    // Try find existing record containing this PI id (details or trx_id)
    const existing = await prisma.saveTrRecord.findFirst({
      where: {
        OR: [
          { trx_details: { contains: pi.id } },
          { trx_id: { contains: pi.id } }
        ]
      },
      select: { id: true, pay_status: true, trx_details: true }
    });

    const amountDollars = (pi.amount_received ?? pi.amount ?? 0) / 100;

    let record;
    if (existing) {
      // Merge previous details with new Stripe fields to preserve metadata
      let prevDetails = {};
      try { prevDetails = JSON.parse(existing.trx_details || '{}'); } catch (_) { prevDetails = {}; }
      record = await prisma.saveTrRecord.update({
        where: { id: existing.id },
        data: {
          // Only upgrade status forward unless force_update is true
          pay_status: force_update ? dbStatus : (existing.pay_status === 'completed' ? 'completed' : dbStatus),
          trx_amount: amountDollars || undefined,
          trx_recipt_url: receiptUrl,
          updated_at: new Date(),
          trx_details: JSON.stringify({ ...prevDetails, ...trxDetails }),
        }
      });
    } else {
      record = await prisma.saveTrRecord.create({
        data: {
          trx_id: `pi_${pi.id}_${Date.now()}`,
          trx_date: new Date(),
          trx_amount: amountDollars,
          trx_method: 'stripe',
          trx_donor_id: donor_id,
          trx_organization_id: organization_id,
          trx_recipt_url: receiptUrl,
          trx_details: JSON.stringify(trxDetails),
          pay_status: dbStatus,
        }
      });
    }

    // If completed, increment organization balance
    if (dbStatus === 'completed' && amountDollars > 0) {
      await prisma.organization.update({
        where: { id: organization_id },
        data: { balance: { increment: amountDollars } }
      });
    }

    return NextResponse.json({
      success: true,
      status: pi.status,
      db_status: dbStatus,
      payment_intent_id: pi.id,
      receipt_url: receiptUrl,
      transaction: record,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('confirm-and-record error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


