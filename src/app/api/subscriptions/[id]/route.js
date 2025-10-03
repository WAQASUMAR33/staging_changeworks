import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getStripe, isStripeConfigured, handleStripeError } from "@/lib/stripe";

// GET /api/subscriptions/[id] - Get specific subscription
export async function GET(request, { params }) {
  try {
    // Check if Stripe is properly configured
    if (!isStripeConfigured()) {
      return NextResponse.json({ 
        error: "Payment service not configured. Please contact support." 
      }, { status: 503 });
    }

    const stripe = getStripe();
    const subscriptionId = params.id;

    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscriptionId) },
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            address: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            features: true,
            duration: true,
            category: true
          }
        },
        subscription_transactions: {
          orderBy: {
            created_at: 'desc'
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

    // Get latest Stripe subscription data
    let stripeSubscription = null;
    try {
      stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    } catch (stripeError) {
      console.warn('Could not fetch Stripe subscription:', stripeError.message);
    }

    return NextResponse.json({
      success: true,
      subscription: {
        ...subscription,
        stripe_data: stripeSubscription
      }
    });

  } catch (error) {
    console.error('Error fetching subscription:', error);
    
    // Handle Stripe errors using the utility
    if (error.type && error.type.startsWith('Stripe')) {
      const { error: errorMessage, status } = handleStripeError(error, 'Fetch subscription');
      return NextResponse.json({ success: false, error: errorMessage }, { status });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription' },
      { status: 500 }
    );
  }
}

// PUT /api/subscriptions/[id] - Update subscription
export async function PUT(request, { params }) {
  try {
    // Check if Stripe is properly configured
    if (!isStripeConfigured()) {
      return NextResponse.json({ 
        error: "Payment service not configured. Please contact support." 
      }, { status: 503 });
    }

    const stripe = getStripe();
    const subscriptionId = params.id;
    const body = await request.json();
    const { action, ...updateData } = body;

    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscriptionId) }
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    let updatedSubscription;
    let stripeResponse = null;

    switch (action) {
      case 'update_payment_method':
        const { payment_method_id } = updateData;
        if (!payment_method_id) {
          return NextResponse.json(
            { success: false, error: 'Payment method ID is required' },
            { status: 400 }
          );
        }

        try {
          // Attach new payment method to customer
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
          await stripe.paymentMethods.attach(payment_method_id, {
            customer: stripeSubscription.customer,
          });

          // Update default payment method
          await stripe.customers.update(stripeSubscription.customer, {
            invoice_settings: {
              default_payment_method: payment_method_id,
            },
          });

          stripeResponse = { message: 'Payment method updated successfully' };
        } catch (stripeError) {
          console.error('Stripe payment method update error:', stripeError);
          return NextResponse.json(
            { success: false, error: 'Failed to update payment method' },
            { status: 500 }
          );
        }
        break;

      case 'update_quantity':
        const { quantity } = updateData;
        if (!quantity || quantity < 1) {
          return NextResponse.json(
            { success: false, error: 'Valid quantity is required' },
            { status: 400 }
          );
        }

        try {
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            items: [{
              id: stripeSubscription.items.data[0].id,
              quantity: quantity,
            }],
            proration_behavior: 'create_prorations',
          });

          stripeResponse = { message: 'Subscription quantity updated successfully' };
        } catch (stripeError) {
          console.error('Stripe quantity update error:', stripeError);
          return NextResponse.json(
            { success: false, error: 'Failed to update subscription quantity' },
            { status: 500 }
          );
        }
        break;

      case 'reactivate':
        try {
          await stripe.subscriptions.update(subscription.stripe_subscription_id, {
            cancel_at_period_end: false,
          });

          updatedSubscription = await prisma.subscription.update({
            where: { id: parseInt(subscriptionId) },
            data: {
              cancel_at_period_end: false,
              canceled_at: null
            }
          });

          stripeResponse = { message: 'Subscription reactivated successfully' };
        } catch (stripeError) {
          console.error('Stripe reactivation error:', stripeError);
          return NextResponse.json(
            { success: false, error: 'Failed to reactivate subscription' },
            { status: 500 }
          );
        }
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action. Supported actions: update_payment_method, update_quantity, reactivate' },
          { status: 400 }
        );
    }

    // If no database update was made in the action, fetch the updated subscription
    if (!updatedSubscription) {
      updatedSubscription = await prisma.subscription.findUnique({
        where: { id: parseInt(subscriptionId) },
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
    }

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
      stripe_response: stripeResponse,
      message: 'Subscription updated successfully'
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    
    // Handle Stripe errors using the utility
    if (error.type && error.type.startsWith('Stripe')) {
      const { error: errorMessage, status } = handleStripeError(error, 'Update subscription');
      return NextResponse.json({ success: false, error: errorMessage }, { status });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to update subscription' },
      { status: 500 }
    );
  }
}

// DELETE /api/subscriptions/[id] - Cancel subscription
export async function DELETE(request, { params }) {
  try {
    // Check if Stripe is properly configured
    if (!isStripeConfigured()) {
      return NextResponse.json({ 
        error: "Payment service not configured. Please contact support." 
      }, { status: 503 });
    }

    const stripe = getStripe();
    const subscriptionId = params.id;
    const { searchParams } = new URL(request.url);
    const cancelImmediately = searchParams.get('immediate') === 'true';

    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscriptionId) }
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    let stripeResponse;

    try {
      if (cancelImmediately) {
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
    } catch (stripeError) {
      console.error('Stripe cancellation error:', stripeError);
      return NextResponse.json(
        { success: false, error: 'Failed to cancel subscription in Stripe' },
        { status: 500 }
      );
    }

    // Update database
    const updatedSubscription = await prisma.subscription.update({
      where: { id: parseInt(subscriptionId) },
      data: {
        cancel_at_period_end: !cancelImmediately,
        canceled_at: cancelImmediately ? new Date() : null,
        status: cancelImmediately ? 'CANCELED' : 'CANCELED_AT_PERIOD_END',
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

    return NextResponse.json({
      success: true,
      subscription: updatedSubscription,
      stripe_response: stripeResponse,
      message: cancelImmediately ? 'Subscription canceled successfully' : 'Subscription scheduled for cancellation'
    });

  } catch (error) {
    console.error('Error canceling subscription:', error);
    
    // Handle Stripe errors using the utility
    if (error.type && error.type.startsWith('Stripe')) {
      const { error: errorMessage, status } = handleStripeError(error, 'Cancel subscription');
      return NextResponse.json({ success: false, error: errorMessage }, { status });
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}