import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import jwt from "jsonwebtoken";
import { getStripe, isStripeConfigured, handleStripeError } from "@/lib/stripe";

// POST /api/donor/subscriptions/[id]/[action] - Handle subscription actions (pause, resume, cancel)
export async function POST(request, { params }) {
  try {
    // Check if Stripe is properly configured
    if (!isStripeConfigured()) {
      return NextResponse.json({ 
        error: "Payment service not configured. Please contact support." 
      }, { status: 503 });
    }

    const stripe = getStripe();

    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    // Get params
    const { id, action } = await params;
    const subscriptionId = parseInt(id);

    if (!subscriptionId || !action) {
      return NextResponse.json({ 
        error: "Subscription ID and action are required" 
      }, { status: 400 });
    }

    // Find the subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        donor_id: donorId // Ensure the subscription belongs to the authenticated donor
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

    if (!subscription) {
      return NextResponse.json({ 
        error: "Subscription not found or access denied" 
      }, { status: 404 });
    }

    let result;
    let updatedSubscription;

    switch (action.toLowerCase()) {
      case 'cancel':
        // Cancel the subscription
        if (subscription.status === 'CANCELED') {
          return NextResponse.json({ 
            error: "Subscription is already canceled" 
          }, { status: 400 });
        }

        // Cancel at period end in Stripe
        await stripe.subscriptions.update(subscription.stripe_subscription_id, {
          cancel_at_period_end: true,
        });

        // Update database
        updatedSubscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            cancel_at_period_end: true,
            status: 'ACTIVE', // Keep as ACTIVE when cancel_at_period_end is true
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

        result = {
          success: true,
          message: 'Subscription scheduled for cancellation at period end',
          subscription: updatedSubscription
        };
        break;

      case 'pause':
        // Pause the subscription (cancel immediately)
        if (subscription.status === 'CANCELED') {
          return NextResponse.json({ 
            error: "Subscription is already canceled" 
          }, { status: 400 });
        }

        // Cancel immediately in Stripe
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);

        // Update database
        updatedSubscription = await prisma.subscription.update({
          where: { id: subscriptionId },
          data: {
            status: 'CANCELED',
            canceled_at: new Date(),
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

        result = {
          success: true,
          message: 'Subscription paused (canceled immediately)',
          subscription: updatedSubscription
        };
        break;

      case 'resume':
        // Resume the subscription (create a new subscription)
        if (subscription.status === 'ACTIVE') {
          return NextResponse.json({ 
            error: "Subscription is already active" 
          }, { status: 400 });
        }

        // For resume, we would need to create a new subscription
        // This is complex as it requires customer, price, and payment method
        return NextResponse.json({ 
          error: "Resume functionality requires creating a new subscription. Please create a new subscription instead." 
        }, { status: 400 });
        break;

      default:
        return NextResponse.json({ 
          error: "Invalid action. Supported actions: cancel, pause, resume" 
        }, { status: 400 });
    }

    return NextResponse.json(result);

  } catch (error) {
    console.error('Error handling subscription action:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    // Handle Stripe errors using the utility
    if (error.type && error.type.startsWith('Stripe')) {
      const { error: errorMessage, status } = handleStripeError(error, 'Subscription action');
      return NextResponse.json({ error: errorMessage }, { status });
    }
    
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error.message 
    }, { status: 500 });
  }
}
