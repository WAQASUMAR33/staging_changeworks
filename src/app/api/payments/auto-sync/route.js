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

export async function GET(request) {
  try {
    console.log('🔍 Checking for pending payments that need Stripe sync...');

    // Find all pending payments created in the last 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const pendingPayments = await prisma.saveTrRecord.findMany({
      where: {
        pay_status: 'pending',
        trx_method: 'stripe',
        created_at: {
          gte: twentyFourHoursAgo
        }
      },
      select: {
        id: true,
        trx_id: true,
        trx_amount: true,
        trx_donor_id: true,
        trx_organization_id: true,
        trx_details: true,
        created_at: true
      }
    });

    console.log(`📊 Found ${pendingPayments.length} recent pending payments`);

    if (pendingPayments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No recent pending payments found',
        pending_count: 0,
        action_needed: false
      });
    }

    // Check if we can sync with Stripe
    if (!stripe) {
      return NextResponse.json({
        success: true,
        message: 'Found pending payments but Stripe not configured',
        pending_count: pendingPayments.length,
        action_needed: true,
        action: 'Configure Stripe or run manual sync'
      });
    }

    // Check a few payments to see their Stripe status
    const samplePayments = pendingPayments.slice(0, 3);
    const stripeStatuses = [];

    for (const payment of samplePayments) {
      try {
        const parsedDetails = JSON.parse(payment.trx_details || '{}');
        const paymentIntentId = parsedDetails.payment_intent_id;
        
        if (paymentIntentId) {
          const stripePaymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
          stripeStatuses.push({
            payment_id: payment.id,
            amount: payment.trx_amount,
            db_status: 'pending',
            stripe_status: stripePaymentIntent.status,
            needs_sync: stripePaymentIntent.status === 'succeeded' || stripePaymentIntent.status === 'payment_failed'
          });
        }
      } catch (error) {
        stripeStatuses.push({
          payment_id: payment.id,
          amount: payment.trx_amount,
          db_status: 'pending',
          stripe_status: 'error',
          error: error.message
        });
      }
    }

    const needsSync = stripeStatuses.filter(s => s.needs_sync).length;
    const totalChecked = stripeStatuses.length;

    return NextResponse.json({
      success: true,
      message: `Found ${pendingPayments.length} pending payments`,
      pending_count: pendingPayments.length,
      action_needed: needsSync > 0,
      sync_recommended: needsSync > 0,
      sample_check: {
        checked: totalChecked,
        need_sync: needsSync,
        stripe_statuses: stripeStatuses
      },
      action: needsSync > 0 ? 
        `Run POST /api/payments/sync-stripe-status to sync ${needsSync} payments` :
        'All payments are properly synced'
    });

  } catch (error) {
    console.error('❌ Error checking pending payments:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
