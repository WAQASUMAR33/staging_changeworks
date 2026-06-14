import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/payments - Get payment history for subscriptions
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscription_id');
    const donorId = searchParams.get('donor_id');
    const organizationId = searchParams.get('organization_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;

    // Build where clause for database query
    const where = {};
    if (subscriptionId) where.subscription_id = parseInt(subscriptionId);
    if (donorId) where.donor_id = parseInt(donorId);
    if (organizationId) where.organization_id = parseInt(organizationId);
    if (status) where.status = status;

    // Get subscription transactions from database
    const transactions = await prisma.subscriptionTransaction.findMany({
      where,
      include: {
        subscription: {
          include: {
            donor: { select: { id: true, name: true, email: true } },
            organization: { select: { id: true, name: true } },
            package: { select: { id: true, name: true, price: true, currency: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      skip,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.subscriptionTransaction.count({ where });

    // If we have subscription IDs, also get Stripe payment intents
    let stripePayments = [];
    if (transactions.length > 0) {
      const subscriptionIds = [...new Set(transactions.map(t => t.subscription.stripe_subscription_id))];
      
      for (const stripeSubscriptionId of subscriptionIds) {
        try {
          // Get payment intents for this subscription
          const paymentIntents = await stripe.paymentIntents.list({
            limit: 10
          });

          // Filter payment intents that belong to this subscription
          const subscriptionPayments = paymentIntents.data.filter(pi => 
            pi.metadata && pi.metadata.subscription_id === stripeSubscriptionId
          );

          stripePayments.push(...subscriptionPayments);
        } catch (error) {
          console.log(`Error fetching Stripe payments for subscription ${stripeSubscriptionId}:`, error.message);
        }
      }
    }

    return NextResponse.json({
      success: true,
      transactions: transactions.map(transaction => ({
        id: transaction.id,
        stripe_transaction_id: transaction.stripe_transaction_id,
        subscription_id: transaction.subscription_id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        payment_method: transaction.payment_method,
        description: transaction.description,
        created_at: transaction.created_at,
        updated_at: transaction.updated_at,
        subscription: {
          id: transaction.subscription.id,
          stripe_subscription_id: transaction.subscription.stripe_subscription_id,
          status: transaction.subscription.status,
          donor: transaction.subscription.donor,
          organization: transaction.subscription.organization,
          package: transaction.subscription.package
        }
      })),
      stripe_payments: stripePayments.map(payment => ({
        id: payment.id,
        amount: payment.amount / 100, // Convert from cents
        currency: payment.currency,
        status: payment.status,
        created: new Date(payment.created * 1000),
        description: payment.description,
        metadata: payment.metadata
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subscription payments:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription payments' },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions/payments - Create a manual payment for subscription
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      subscription_id,
      amount,
      currency = 'USD',
      payment_method_id,
      description,
      metadata = {}
    } = body;

    if (!subscription_id || !amount || !payment_method_id) {
      return NextResponse.json(
        { success: false, error: 'subscription_id, amount, and payment_method_id are required' },
        { status: 400 }
      );
    }

    // Get subscription details
    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscription_id) },
      include: {
        donor: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
        package: { select: { id: true, name: true, price: true, currency: true } }
      }
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get Stripe customer ID
    const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    const customerId = stripeSubscription.customer;

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      customer: customerId,
      payment_method: payment_method_id,
      confirmation_method: 'manual',
      confirm: true,
      description: description || `Manual payment for subscription ${subscription.stripe_subscription_id}`,
      metadata: {
        subscription_id: subscription.stripe_subscription_id,
        donor_id: subscription.donor_id.toString(),
        organization_id: subscription.organization_id.toString(),
        ...metadata
      }
    });

    // Save transaction to database
    const transaction = await prisma.subscriptionTransaction.create({
      data: {
        stripe_transaction_id: paymentIntent.id,
        subscription_id: subscription.id,
        amount: amount,
        currency: currency,
        status: paymentIntent.status.toUpperCase(),
        payment_method: 'stripe',
        description: description || `Manual payment for subscription`,
        metadata: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          customer_id: customerId,
          created_via: 'manual_payment',
          ...metadata
        })
      },
      include: {
        subscription: {
          include: {
            donor: { select: { id: true, name: true, email: true } },
            organization: { select: { id: true, name: true } },
            package: { select: { id: true, name: true, price: true, currency: true } }
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      transaction: {
        id: transaction.id,
        stripe_transaction_id: transaction.stripe_transaction_id,
        subscription_id: transaction.subscription_id,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        payment_method: transaction.payment_method,
        description: transaction.description,
        created_at: transaction.created_at,
        subscription: transaction.subscription
      },
      payment_intent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        client_secret: paymentIntent.client_secret
      },
      message: 'Payment created successfully'
    });

  } catch (error) {
    console.error('Error creating subscription payment:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription payment' },
      { status: 500 }
    );
  }
}
