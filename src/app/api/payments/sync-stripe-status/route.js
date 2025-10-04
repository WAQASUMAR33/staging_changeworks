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
    console.log('🔄 Syncing Stripe payment status with database...');

    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: 'Stripe not configured'
      }, { status: 503 });
    }

    // Find all pending payments
    const pendingPayments = await prisma.saveTrRecord.findMany({
      where: {
        pay_status: 'pending',
        trx_method: 'stripe'
      },
      select: {
        id: true,
        trx_id: true,
        trx_amount: true,
        trx_donor_id: true,
        trx_organization_id: true,
        trx_details: true
      }
    });

    console.log(`📊 Found ${pendingPayments.length} pending payments to sync`);

    if (pendingPayments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending payments found',
        updated_count: 0
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each pending payment
    for (const payment of pendingPayments) {
      try {
        console.log(`🔄 Syncing payment ${payment.id}: $${payment.trx_amount}`);

        // Parse existing details to get payment intent ID
        let parsedDetails = {};
        try {
          parsedDetails = JSON.parse(payment.trx_details || '{}');
        } catch (e) {
          parsedDetails = {};
        }

        const paymentIntentId = parsedDetails.payment_intent_id;
        if (!paymentIntentId) {
          console.log(`⚠️ No payment intent ID found for payment ${payment.id}`);
          results.push({
            id: payment.id,
            amount: payment.trx_amount,
            status: 'skipped',
            reason: 'No payment intent ID found'
          });
          continue;
        }

        // Check payment status in Stripe
        const stripePaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        console.log(`🔍 Stripe status for ${paymentIntentId}: ${stripePaymentIntent.status}`);

        // Update database based on Stripe status
        if (stripePaymentIntent.status === 'succeeded') {
          // Payment succeeded in Stripe, update to completed
          const updatedPayment = await prisma.saveTrRecord.update({
            where: {
              id: payment.id
            },
            data: {
              pay_status: 'completed',
              trx_recipt_url: stripePaymentIntent.receipt_url || `https://pay.stripe.com/receipts/${paymentIntentId}`,
              trx_details: JSON.stringify({
                ...parsedDetails,
                stripe_status: stripePaymentIntent.status,
                stripe_amount_received: stripePaymentIntent.amount_received,
                stripe_payment_method: stripePaymentIntent.payment_method,
                stripe_created: new Date(stripePaymentIntent.created * 1000),
                webhook_processed_at: new Date(),
                synced_from_stripe: true
              }),
              updated_at: new Date()
            }
          });

          // Update organization balance
          await prisma.organization.update({
            where: { id: payment.trx_organization_id },
            data: {
              balance: {
                increment: payment.trx_amount
              }
            }
          });

          results.push({
            id: payment.id,
            amount: payment.trx_amount,
            stripe_status: stripePaymentIntent.status,
            db_status: 'completed',
            organization_id: payment.trx_organization_id
          });

          successCount++;
          console.log(`✅ Updated payment ${payment.id} to completed (Stripe: succeeded)`);

        } else if (stripePaymentIntent.status === 'payment_failed') {
          // Payment failed in Stripe, update to failed
          await prisma.saveTrRecord.update({
            where: {
              id: payment.id
            },
            data: {
              pay_status: 'failed',
              trx_details: JSON.stringify({
                ...parsedDetails,
                stripe_status: stripePaymentIntent.status,
                stripe_last_payment_error: stripePaymentIntent.last_payment_error,
                webhook_processed_at: new Date(),
                synced_from_stripe: true
              }),
              updated_at: new Date()
            }
          });

          results.push({
            id: payment.id,
            amount: payment.trx_amount,
            stripe_status: stripePaymentIntent.status,
            db_status: 'failed'
          });

          successCount++;
          console.log(`❌ Updated payment ${payment.id} to failed (Stripe: payment_failed)`);

        } else {
          // Payment still processing or other status
          results.push({
            id: payment.id,
            amount: payment.trx_amount,
            stripe_status: stripePaymentIntent.status,
            db_status: 'still_pending'
          });

          console.log(`⏳ Payment ${payment.id} still processing (Stripe: ${stripePaymentIntent.status})`);
        }

      } catch (error) {
        console.error(`❌ Error syncing payment ${payment.id}:`, error.message);
        results.push({
          id: payment.id,
          amount: payment.trx_amount,
          status: 'error',
          error: error.message
        });
        errorCount++;
      }
    }

    // Get updated organization balances
    const organizationIds = [...new Set(pendingPayments.map(p => p.trx_organization_id))];
    const organizations = await prisma.organization.findMany({
      where: {
        id: { in: organizationIds }
      },
      select: {
        id: true,
        name: true,
        balance: true
      }
    });

    console.log(`✅ Stripe sync finished: ${successCount} updated, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: `Stripe sync completed: ${successCount} payments updated, ${errorCount} errors`,
      summary: {
        total_checked: pendingPayments.length,
        updated: successCount,
        errors: errorCount
      },
      results: results,
      organizations: organizations
    });

  } catch (error) {
    console.error('❌ Error in Stripe sync:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
