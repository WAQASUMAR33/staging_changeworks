import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    const { session_id } = body;

    if (!session_id) {
      return NextResponse.json(
        { success: false, error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Test the checkout session verification
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/subscriptions/checkout-session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ session_id }),
    });

    const data = await response.json();

    if (data.success) {
      // Check if records were created in all tables
      const subscription = await prisma.subscription.findFirst({
        where: { stripe_subscription_id: data.subscription.stripe_subscription_id },
        include: {
          donor: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } }
        }
      });

      const transaction = await prisma.saveTrRecord.findFirst({
        where: { trx_details: { contains: session_id } }
      });

      const donorTransaction = await prisma.donorTransaction.findFirst({
        where: { stripe_session_id: session_id }
      });

      return NextResponse.json({
        success: true,
        message: 'Payment verification and database record creation test completed',
        verification_result: data,
        database_records: {
          subscription: subscription ? {
            id: subscription.id,
            status: subscription.status,
            amount: subscription.amount,
            donor: subscription.donor,
            organization: subscription.organization
          } : null,
          transaction: transaction ? {
            id: transaction.id,
            amount: transaction.trx_amount,
            status: transaction.pay_status,
            method: transaction.trx_method
          } : null,
          donor_transaction: donorTransaction ? {
            id: donorTransaction.id,
            amount: donorTransaction.amount,
            status: donorTransaction.status,
            type: donorTransaction.transaction_type
          } : null
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: data.error,
        message: 'Payment verification failed'
      });
    }

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      message: 'Test failed'
    }, { status: 500 });
  }
}
