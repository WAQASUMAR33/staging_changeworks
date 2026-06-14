import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from 'stripe';
import { prisma } from "../../../lib/prisma";

let stripe;
try {
  if (process.env.STRIPE_SECRET_KEY) {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
  }
} catch (e) {
  console.error('Stripe init error:', e);
}

const schema = z.object({
  payment_intent_id: z.string().min(1)
});

export async function POST(request) {
  try {
    if (!stripe) {
      return NextResponse.json({ success: false, error: 'Stripe not configured' }, { status: 503 });
    }

    const body = await request.json();
    const { payment_intent_id } = schema.parse(body);

    const pi = await stripe.paymentIntents.retrieve(payment_intent_id, { expand: ['latest_charge'] });

    // Try to find matching DB record
    const record = await prisma.saveTrRecord.findFirst({
      where: {
        OR: [
          { trx_details: { contains: payment_intent_id } },
          { trx_id: { contains: payment_intent_id } }
        ]
      },
      select: {
        id: true,
        trx_id: true,
        trx_amount: true,
        trx_method: true,
        trx_donor_id: true,
        trx_organization_id: true,
        pay_status: true,
        trx_recipt_url: true,
        created_at: true,
        updated_at: true
      }
    });

    return NextResponse.json({
      success: true,
      intent: {
        id: pi.id,
        status: pi.status,
        amount: pi.amount,
        amount_received: pi.amount_received,
        currency: pi.currency,
        latest_charge: typeof pi.latest_charge === 'string' ? pi.latest_charge : {
          id: pi.latest_charge?.id,
          receipt_url: pi.latest_charge?.receipt_url,
          status: pi.latest_charge?.status
        },
        next_action: pi.next_action || null,
        client_secret: pi.client_secret
      },
      db_record: record || null
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    console.error('check-intent error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}


