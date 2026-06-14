import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/refunds - Get refund history for subscriptions
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

    // Build where clause
    const where = {};
    if (subscriptionId) where.subscription_id = parseInt(subscriptionId);
    if (donorId) where.donor_id = parseInt(donorId);
    if (organizationId) where.organization_id = parseInt(organizationId);
    if (status) where.status = status;

    // Get refunds from database (we'll store refunds in subscription_transactions with type 'refund')
    const refunds = await prisma.subscriptionTransaction.findMany({
      where: {
        ...where,
        status: 'REFUNDED'
      },
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
    const totalCount = await prisma.subscriptionTransaction.count({
      where: {
        ...where,
        status: 'REFUNDED'
      }
    });

    // Get Stripe refunds
    let stripeRefunds = [];
    if (refunds.length > 0) {
      try {
        const allRefunds = await stripe.refunds.list({
          limit: 100
        });

        // Filter refunds that belong to our subscriptions
        const subscriptionIds = [...new Set(refunds.map(r => r.subscription.stripe_subscription_id))];
        stripeRefunds = allRefunds.data.filter(refund => {
          // Check if refund belongs to any of our subscriptions
          return subscriptionIds.some(subId => 
            refund.metadata && refund.metadata.subscription_id === subId
          );
        });
      } catch (error) {
        console.log('Error fetching Stripe refunds:', error.message);
      }
    }

    return NextResponse.json({
      success: true,
      refunds: refunds.map(refund => ({
        id: refund.id,
        stripe_transaction_id: refund.stripe_transaction_id,
        subscription_id: refund.subscription_id,
        amount: refund.amount,
        currency: refund.currency,
        status: refund.status,
        payment_method: refund.payment_method,
        description: refund.description,
        created_at: refund.created_at,
        updated_at: refund.updated_at,
        subscription: {
          id: refund.subscription.id,
          stripe_subscription_id: refund.subscription.stripe_subscription_id,
          status: refund.subscription.status,
          donor: refund.subscription.donor,
          organization: refund.subscription.organization,
          package: refund.subscription.package
        }
      })),
      stripe_refunds: stripeRefunds.map(refund => ({
        id: refund.id,
        amount: refund.amount / 100, // Convert from cents
        currency: refund.currency,
        status: refund.status,
        reason: refund.reason,
        created: new Date(refund.created * 1000),
        description: refund.description,
        metadata: refund.metadata
      })),
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subscription refunds:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription refunds' },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions/refunds - Create a refund for a subscription payment
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      subscription_id,
      transaction_id,
      amount,
      reason = 'requested_by_customer',
      metadata = {}
    } = body;

    if (!subscription_id || !transaction_id) {
      return NextResponse.json(
        { success: false, error: 'subscription_id and transaction_id are required' },
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

    // Get transaction details
    const transaction = await prisma.subscriptionTransaction.findFirst({
      where: {
        id: parseInt(transaction_id),
        subscription_id: parseInt(subscription_id)
      }
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction not found' },
        { status: 404 }
      );
    }

    // Check if transaction is already refunded
    if (transaction.status === 'REFUNDED') {
      return NextResponse.json(
        { success: false, error: 'Transaction is already refunded' },
        { status: 400 }
      );
    }

    // Create refund in Stripe
    const refundData = {
      payment_intent: transaction.stripe_transaction_id,
      reason: reason,
      metadata: {
        subscription_id: subscription.stripe_subscription_id,
        donor_id: subscription.donor_id.toString(),
        organization_id: subscription.organization_id.toString(),
        original_transaction_id: transaction.id.toString(),
        ...metadata
      }
    };

    // Add amount if partial refund
    if (amount && amount < transaction.amount) {
      refundData.amount = Math.round(amount * 100); // Convert to cents
    }

    const stripeRefund = await stripe.refunds.create(refundData);

    // Update transaction status in database
    const updatedTransaction = await prisma.subscriptionTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'REFUNDED',
        metadata: JSON.stringify({
          ...JSON.parse(transaction.metadata || '{}'),
          refund_id: stripeRefund.id,
          refund_amount: stripeRefund.amount / 100,
          refund_reason: stripeRefund.reason,
          refunded_at: new Date().toISOString()
        })
      }
    });

    // Create refund record
    const refundRecord = await prisma.subscriptionTransaction.create({
      data: {
        stripe_transaction_id: stripeRefund.id,
        subscription_id: subscription.id,
        amount: -(stripeRefund.amount / 100), // Negative amount for refund
        currency: stripeRefund.currency,
        status: 'REFUNDED',
        payment_method: 'stripe',
        description: `Refund for transaction ${transaction.stripe_transaction_id}`,
        metadata: JSON.stringify({
          refund_id: stripeRefund.id,
          original_transaction_id: transaction.id,
          refund_reason: stripeRefund.reason,
          created_via: 'api_refund',
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
      refund: {
        id: refundRecord.id,
        stripe_refund_id: stripeRefund.id,
        subscription_id: refundRecord.subscription_id,
        amount: refundRecord.amount,
        currency: refundRecord.currency,
        status: refundRecord.status,
        description: refundRecord.description,
        created_at: refundRecord.created_at,
        subscription: refundRecord.subscription
      },
      stripe_refund: {
        id: stripeRefund.id,
        amount: stripeRefund.amount / 100,
        currency: stripeRefund.currency,
        status: stripeRefund.status,
        reason: stripeRefund.reason,
        created: new Date(stripeRefund.created * 1000)
      },
      message: 'Refund created successfully'
    });

  } catch (error) {
    console.error('Error creating subscription refund:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription refund' },
      { status: 500 }
    );
  }
}
