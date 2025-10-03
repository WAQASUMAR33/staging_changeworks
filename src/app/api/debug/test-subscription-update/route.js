import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// GET /api/debug/test-subscription-update - Test subscription database update
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscription_id');
    const donorId = searchParams.get('donor_id');

    if (!subscriptionId && !donorId) {
      return NextResponse.json(
        { success: false, error: 'subscription_id or donor_id parameter is required' },
        { status: 400 }
      );
    }

    let whereClause = {};
    if (subscriptionId) {
      whereClause.id = parseInt(subscriptionId);
    }
    if (donorId) {
      whereClause.donor_id = parseInt(donorId);
    }

    // Find subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: whereClause,
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { 
          success: true,
          message: 'No subscriptions found',
          subscriptions: []
        }
      );
    }

    // Test database update on first subscription
    const testSubscription = subscriptions[0];
    console.log(`Testing database update for subscription ${testSubscription.id}`);
    console.log(`Current status: ${testSubscription.status}`);
    console.log(`Current cancel_at_period_end: ${testSubscription.cancel_at_period_end}`);

    // Try to update the subscription
    try {
      const updatedSubscription = await prisma.subscription.update({
        where: { id: testSubscription.id },
        data: {
          updated_at: new Date()
        }
      });
      
      console.log(`Successfully updated subscription ${testSubscription.id}`);
      console.log(`Updated at: ${updatedSubscription.updated_at}`);

      return NextResponse.json({
        success: true,
        message: 'Database update test successful',
        test_subscription: {
          id: testSubscription.id,
          status: testSubscription.status,
          cancel_at_period_end: testSubscription.cancel_at_period_end,
          stripe_subscription_id: testSubscription.stripe_subscription_id,
          updated_at: updatedSubscription.updated_at
        },
        all_subscriptions: subscriptions
      });

    } catch (updateError) {
      console.error(`Database update failed:`, updateError);
      return NextResponse.json({
        success: false,
        error: 'Database update failed',
        details: updateError.message,
        test_subscription: {
          id: testSubscription.id,
          status: testSubscription.status,
          cancel_at_period_end: testSubscription.cancel_at_period_end,
          stripe_subscription_id: testSubscription.stripe_subscription_id
        },
        all_subscriptions: subscriptions
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in test subscription update:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test subscription update', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/debug/test-subscription-update - Test actual status update
export async function POST(request) {
  try {
    const body = await request.json();
    const { subscription_id, new_status, cancel_immediately = false } = body;

    if (!subscription_id) {
      return NextResponse.json(
        { success: false, error: 'subscription_id is required' },
        { status: 400 }
      );
    }

    // Find the subscription
    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscription_id) },
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    console.log(`Testing status update for subscription ${subscription.id}`);
    console.log(`Current status: ${subscription.status}`);
    console.log(`New status: ${new_status || (cancel_immediately ? 'CANCELED' : 'CANCELED_AT_PERIOD_END')}`);

    // Update the subscription
    const updatedSubscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        cancel_at_period_end: !cancel_immediately,
        canceled_at: cancel_immediately ? new Date() : null,
        status: new_status || (cancel_immediately ? 'CANCELED' : 'CANCELED_AT_PERIOD_END'),
        updated_at: new Date()
      },
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    console.log(`Successfully updated subscription ${subscription.id}`);
    console.log(`New status: ${updatedSubscription.status}`);
    console.log(`Cancel at period end: ${updatedSubscription.cancel_at_period_end}`);

    return NextResponse.json({
      success: true,
      message: 'Status update test successful',
      original_subscription: {
        id: subscription.id,
        status: subscription.status,
        cancel_at_period_end: subscription.cancel_at_period_end,
        stripe_subscription_id: subscription.stripe_subscription_id
      },
      updated_subscription: {
        id: updatedSubscription.id,
        status: updatedSubscription.status,
        cancel_at_period_end: updatedSubscription.cancel_at_period_end,
        canceled_at: updatedSubscription.canceled_at,
        updated_at: updatedSubscription.updated_at,
        stripe_subscription_id: updatedSubscription.stripe_subscription_id
      }
    });

  } catch (error) {
    console.error('Error in test status update:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test status update', details: error.message },
      { status: 500 }
    );
  }
}
