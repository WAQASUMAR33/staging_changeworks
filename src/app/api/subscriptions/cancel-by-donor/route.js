import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/subscriptions/cancel-by-donor - Cancel subscription by donor ID
export async function POST(request) {
  try {
    const body = await request.json();
    const { donor_id, cancel_immediately = false } = body;

    // Validate required fields
    if (!donor_id) {
      return NextResponse.json(
        { success: false, error: 'donor_id is required' },
        { status: 400 }
      );
    }

    // Find donor's active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        donor_id: parseInt(donor_id),
        status: {
          in: ['ACTIVE', 'TRIALING', 'PAST_DUE']
        }
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
            name: true,
            email: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            features: true
          }
        }
      }
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active subscriptions found for this donor',
          donor_id: parseInt(donor_id)
        },
        { status: 404 }
      );
    }

    const results = [];
    const errors = [];

    // Cancel each subscription
    for (const subscription of subscriptions) {
      try {
        let stripeResponse;

        if (cancel_immediately) {
          // Cancel immediately
          await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
          stripeResponse = { message: 'Subscription canceled immediately' };
        } else {
          // Cancel at period end
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: true,
          });
          stripeResponse = { message: 'Subscription will be canceled at the end of the current period' };
        }

        // Update database
        const updatedSubscription = await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            cancel_at_period_end: !cancel_immediately,
            canceled_at: cancel_immediately ? new Date() : null,
            status: cancel_immediately ? 'CANCELED' : 'CANCELED_AT_PERIOD_END', // Set proper status for both cases
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
                name: true,
                email: true
              }
            },
            package: {
              select: {
                id: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                features: true
              }
            }
          }
        });

        results.push({
          subscription_id: subscription.id,
          stripe_subscription_id: subscription.stripe_subscription_id,
          status: 'success',
          subscription: updatedSubscription,
          stripe_response: stripeResponse
        });

      } catch (stripeError) {
        console.error(`Stripe cancellation error for subscription ${subscription.id}:`, stripeError);
        errors.push({
          subscription_id: subscription.id,
          stripe_subscription_id: subscription.stripe_subscription_id,
          status: 'error',
          error: stripeError.message
        });
      }
    }

    // Prepare response
    const response = {
      success: true,
      donor_id: parseInt(donor_id),
      total_subscriptions: subscriptions.length,
      successful_cancellations: results.length,
      failed_cancellations: errors.length,
      cancel_immediately: cancel_immediately,
      results: results,
      errors: errors.length > 0 ? errors : undefined
    };

    if (errors.length > 0) {
      response.message = `${results.length} subscription(s) canceled successfully, ${errors.length} failed`;
    } else {
      response.message = cancel_immediately 
        ? `${results.length} subscription(s) canceled immediately`
        : `${results.length} subscription(s) scheduled for cancellation at period end`;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error canceling subscription by donor ID:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel subscription', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/subscriptions/cancel-by-donor - Get cancellation status by donor ID
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get('donor_id');

    if (!donorId) {
      return NextResponse.json(
        { success: false, error: 'donor_id parameter is required' },
        { status: 400 }
      );
    }

    // Find all subscriptions for the donor
    const subscriptions = await prisma.subscription.findMany({
      where: {
        donor_id: parseInt(donorId)
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
            name: true,
            email: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            features: true
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
          donor_id: parseInt(donorId),
          message: 'No subscriptions found for this donor',
          subscriptions: []
        }
      );
    }

    // Categorize subscriptions
    const activeSubscriptions = subscriptions.filter(sub => 
      ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status)
    );
    const canceledSubscriptions = subscriptions.filter(sub => 
      ['CANCELED', 'UNPAID'].includes(sub.status)
    );
    const scheduledForCancellation = subscriptions.filter(sub => 
      sub.cancel_at_period_end === true || sub.status === 'CANCELED_AT_PERIOD_END'
    );

    return NextResponse.json({
      success: true,
      donor_id: parseInt(donorId),
      total_subscriptions: subscriptions.length,
      active_subscriptions: activeSubscriptions.length,
      canceled_subscriptions: canceledSubscriptions.length,
      scheduled_for_cancellation: scheduledForCancellation.length,
      subscriptions: subscriptions,
      summary: {
        active: activeSubscriptions,
        canceled: canceledSubscriptions,
        scheduled_for_cancellation: scheduledForCancellation
      }
    });

  } catch (error) {
    console.error('Error fetching subscription status by donor ID:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription status', details: error.message },
      { status: 500 }
    );
  }
}
