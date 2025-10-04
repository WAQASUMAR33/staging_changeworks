import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from 'stripe';

// Initialize Stripe
let stripe;
try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY environment variable is not set');
  } else {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error);
}

export async function POST(request) {
  try {
    const { payment_intent_id } = await request.json();
    
    if (!payment_intent_id) {
      return NextResponse.json({
        success: false,
        error: 'Payment intent ID is required'
      }, { status: 400 });
    }

    console.log(`🔍 Checking completion for payment intent: ${payment_intent_id}`);

    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: 'Stripe not configured'
      }, { status: 503 });
    }

    // Find the transaction in our database
    const transaction = await prisma.saveTrRecord.findFirst({
      where: {
        trx_details: {
          contains: payment_intent_id
        },
        pay_status: 'pending'
      },
      select: {
        id: true,
        trx_amount: true,
        trx_donor_id: true,
        trx_organization_id: true,
        trx_details: true
      }
    });

    if (!transaction) {
      return NextResponse.json({
        success: false,
        error: 'No pending transaction found for this payment intent'
      }, { status: 404 });
    }

    // Check payment status in Stripe
    const stripePaymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    console.log(`🔍 Stripe status: ${stripePaymentIntent.status}`);

    let updatedTransaction = null;
    let organizationUpdated = false;

    if (stripePaymentIntent.status === 'succeeded') {
      // Parse existing details
      let parsedDetails = {};
      try {
        parsedDetails = JSON.parse(transaction.trx_details || '{}');
      } catch (e) {
        parsedDetails = {};
      }

      // Update transaction to completed
      updatedTransaction = await prisma.saveTrRecord.update({
        where: {
          id: transaction.id
        },
        data: {
          pay_status: 'completed',
          trx_recipt_url: stripePaymentIntent.receipt_url || `https://pay.stripe.com/receipts/${payment_intent_id}`,
          trx_details: JSON.stringify({
            ...parsedDetails,
            stripe_status: stripePaymentIntent.status,
            stripe_amount_received: stripePaymentIntent.amount_received,
            stripe_payment_method: stripePaymentIntent.payment_method,
            stripe_created: new Date(stripePaymentIntent.created * 1000),
            completion_checked_at: new Date(),
            completed_via: 'completion_check'
          }),
          updated_at: new Date()
        }
      });

      // Update organization balance
      await prisma.organization.update({
        where: { id: transaction.trx_organization_id },
        data: {
          balance: {
            increment: transaction.trx_amount
          }
        }
      });

      organizationUpdated = true;
      console.log(`✅ Payment completed successfully: $${transaction.trx_amount}`);

    } else if (stripePaymentIntent.status === 'payment_failed') {
      // Update transaction to failed
      updatedTransaction = await prisma.saveTrRecord.update({
        where: {
          id: transaction.id
        },
        data: {
          pay_status: 'failed',
          trx_details: JSON.stringify({
            stripe_status: stripePaymentIntent.status,
            stripe_last_payment_error: stripePaymentIntent.last_payment_error,
            completion_checked_at: new Date(),
            completed_via: 'completion_check'
          }),
          updated_at: new Date()
        }
      });

      console.log(`❌ Payment failed: ${stripePaymentIntent.last_payment_error?.message || 'Unknown error'}`);

    } else {
      // Payment still processing
      console.log(`⏳ Payment still processing: ${stripePaymentIntent.status}`);
    }

    // Get updated organization info
    const organization = await prisma.organization.findUnique({
      where: { id: transaction.trx_organization_id },
      select: {
        id: true,
        name: true,
        balance: true
      }
    });

    return NextResponse.json({
      success: true,
      payment_intent_id: payment_intent_id,
      stripe_status: stripePaymentIntent.status,
      transaction: updatedTransaction ? {
        id: updatedTransaction.id,
        amount: transaction.trx_amount,
        status: updatedTransaction.pay_status
      } : {
        id: transaction.id,
        amount: transaction.trx_amount,
        status: 'still_pending'
      },
      organization: organization,
      organization_updated: organizationUpdated,
      message: stripePaymentIntent.status === 'succeeded' ? 
        'Payment completed successfully' :
        stripePaymentIntent.status === 'payment_failed' ?
        'Payment failed' :
        'Payment still processing'
    });

  } catch (error) {
    console.error('❌ Error checking payment completion:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
