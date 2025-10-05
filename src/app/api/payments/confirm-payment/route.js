import { NextResponse } from "next/server";
import { z } from "zod";
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

// Validation schema
const confirmPaymentSchema = z.object({
  payment_intent_id: z.string().min(1, "Payment intent ID is required"),
  transaction_db_id: z.number().optional(),
});

export async function POST(request) {
  try {
    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: 'Stripe not configured'
      }, { status: 503 });
    }

    const body = await request.json();
    console.log('🔍 Confirm Payment Request Body:', body);
    
    const { payment_intent_id, transaction_db_id } = confirmPaymentSchema.parse(body);

    // Find the transaction in our database
    let transaction;
    if (transaction_db_id) {
      // Find by database ID if provided
      transaction = await prisma.saveTrRecord.findUnique({
        where: { id: transaction_db_id },
        select: {
          id: true,
          trx_amount: true,
          trx_donor_id: true,
          trx_organization_id: true,
          trx_details: true,
          pay_status: true
        }
      });
    } else {
      // Find by payment intent ID in transaction details
      transaction = await prisma.saveTrRecord.findFirst({
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
          trx_details: true,
          pay_status: true
        }
      });
    }

    if (!transaction) {
      return NextResponse.json({
        success: false,
        error: 'Transaction not found or already processed'
      }, { status: 404 });
    }

    // Check payment status in Stripe
    console.log(`🔍 Checking Stripe status for ${payment_intent_id}...`);
    const stripePaymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
    console.log(`📊 Stripe status: ${stripePaymentIntent.status}`);

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
            confirmed_at: new Date(),
            confirmed_by: 'confirm_payment_endpoint'
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
      console.log(`✅ Payment confirmed successfully: $${transaction.trx_amount}`);

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
            confirmed_at: new Date(),
            confirmed_by: 'confirm_payment_endpoint'
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
      transaction_id: transaction.id,
      stripe_status: stripePaymentIntent.status,
      db_status: updatedTransaction ? updatedTransaction.pay_status : transaction.pay_status,
      amount: transaction.trx_amount,
      organization: organization,
      organization_updated: organizationUpdated,
      message: stripePaymentIntent.status === 'succeeded' ? 
        'Payment confirmed and completed successfully' :
        stripePaymentIntent.status === 'payment_failed' ?
        'Payment failed' :
        'Payment still processing'
    });

  } catch (error) {
    console.error('❌ Error confirming payment:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: "Validation error",
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
