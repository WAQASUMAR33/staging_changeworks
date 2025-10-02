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

    // Retrieve the checkout session from Stripe
    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ['subscription']
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Checkout session not found' },
        { status: 404 }
      );
    }

    // Check if the session was successful
    if (session.payment_status !== 'paid') {
      return NextResponse.json(
        { success: false, error: 'Payment was not successful' },
        { status: 400 }
      );
    }

    // Get subscription from session
    const subscription = session.subscription;
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'No subscription found in session' },
        { status: 400 }
      );
    }

    // Get subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.id, {
      expand: ['items.data.price']
    });

    // Extract metadata
    const donorId = parseInt(stripeSubscription.metadata.donor_id);
    const organizationId = parseInt(stripeSubscription.metadata.organization_id);
    const productId = stripeSubscription.metadata.product_id;
    const priceId = stripeSubscription.metadata.price_id;

    // Get donor and organization details
    const [donor, organization] = await Promise.all([
      prisma.donor.findUnique({
        where: { id: donorId },
        select: { id: true, name: true, email: true }
      }),
      prisma.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, email: true }
      })
    ]);

    if (!donor || !organization) {
      return NextResponse.json(
        { success: false, error: 'Donor or organization not found' },
        { status: 404 }
      );
    }

    // Get price details
    const price = stripeSubscription.items.data[0].price;
    const amount = price.unit_amount / 100; // Convert from cents
    const currency = price.currency;
    const interval = price.recurring?.interval || 'month';
    const intervalCount = price.recurring?.interval_count || 1;

    // Create subscription record in database
    const subscriptionData = {
      stripe_subscription_id: stripeSubscription.id,
      donor_id: donorId,
      organization_id: organizationId,
      package_id: 1, // Default package ID
      status: stripeSubscription.status.toUpperCase(),
      current_period_start: new Date(stripeSubscription.current_period_start * 1000),
      current_period_end: new Date(stripeSubscription.current_period_end * 1000),
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
      trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
      trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
      amount: amount,
      currency: currency,
      interval: interval,
      interval_count: intervalCount,
      metadata: JSON.stringify({
        stripe_customer_id: stripeSubscription.customer,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        created_via: 'checkout_success',
        created_at: new Date()
      })
    };

    // Use upsert to create or update
    const dbSubscription = await prisma.subscription.upsert({
      where: {
        stripe_subscription_id: stripeSubscription.id
      },
      update: {
        status: stripeSubscription.status.toUpperCase(),
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
        trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        updated_at: new Date()
      },
      create: subscriptionData
    });

    // Create transaction record in SaveTrRecord table
    const transactionRecord = await prisma.saveTrRecord.create({
      data: {
        trx_id: `sub_${stripeSubscription.id}_${Date.now()}`,
        trx_date: new Date(),
        trx_amount: amount,
        trx_method: 'stripe_subscription',
        trx_donor_id: donorId,
        trx_organization_id: organizationId,
        pay_status: 'completed',
        trx_recipt_url: session.receipt_url || null,
        trx_details: JSON.stringify({
          subscription_id: stripeSubscription.id,
          session_id: session.id,
          payment_intent_id: session.payment_intent,
          stripe_customer_id: stripeSubscription.customer,
          stripe_product_id: productId,
          stripe_price_id: priceId,
          subscription_status: stripeSubscription.status,
          created_via: 'checkout_success',
          created_at: new Date()
        })
      }
    });

    // Create donor transaction record
    const donorTransaction = await prisma.donorTransaction.create({
      data: {
        donor_id: donorId,
        organization_id: organizationId,
        amount: amount,
        currency: currency,
        transaction_type: 'subscription',
        status: 'completed',
        stripe_subscription_id: stripeSubscription.id,
        stripe_session_id: session.id,
        stripe_payment_intent_id: session.payment_intent,
        description: `Subscription: ${stripeSubscription.id}`,
        metadata: JSON.stringify({
          subscription_id: dbSubscription.id,
          save_tr_record_id: transactionRecord.id,
          stripe_product_id: productId,
          stripe_price_id: priceId,
          created_via: 'checkout_success'
        })
      }
    });

    console.log(`✅ Subscription ${stripeSubscription.id} processed successfully:`);
    console.log(`   - Subscription ID: ${dbSubscription.id}`);
    console.log(`   - Transaction ID: ${transactionRecord.id}`);
    console.log(`   - Donor Transaction ID: ${donorTransaction.id}`);

    return NextResponse.json({
      success: true,
      message: 'Subscription created successfully',
      subscription: {
        id: dbSubscription.id,
        status: dbSubscription.status,
        amount: dbSubscription.amount,
        currency: dbSubscription.currency,
        interval: dbSubscription.interval
      },
      transaction: {
        id: transactionRecord.id,
        amount: transactionRecord.trx_amount,
        status: transactionRecord.pay_status
      },
      donor_transaction: {
        id: donorTransaction.id,
        amount: donorTransaction.amount,
        status: donorTransaction.status
      }
    });

  } catch (error) {
    console.error('Checkout session processing error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to process checkout session' },
      { status: 500 }
    );
  }
}
