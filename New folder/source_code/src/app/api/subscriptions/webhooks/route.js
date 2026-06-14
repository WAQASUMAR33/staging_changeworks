import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

// POST /api/subscriptions/webhooks - Handle subscription-specific webhooks
export async function POST(request) {
  try {
    if (!stripe) {
      console.error('Stripe not initialized - webhook cannot be processed');
      return NextResponse.json({
        error: 'Payment service not available'
      }, { status: 503 });
    }

    if (!endpointSecret) {
      console.error('Webhook secret not configured');
      return NextResponse.json({
        error: 'Webhook configuration missing'
      }, { status: 503 });
    }

    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    let event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({
        error: 'Webhook signature verification failed'
      }, { status: 400 });
    }

    console.log(`Received webhook event: ${event.type}`);

    // Handle subscription-specific events
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.created':
        await handleInvoiceCreated(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case 'invoice.finalized':
        await handleInvoiceFinalized(event.data.object);
        break;

      case 'invoice.payment_action_required':
        await handleInvoicePaymentActionRequired(event.data.object);
        break;

      case 'payment_method.attached':
        await handlePaymentMethodAttached(event.data.object);
        break;

      case 'payment_method.detached':
        await handlePaymentMethodDetached(event.data.object);
        break;

      case 'charge.succeeded':
        await handleChargeSucceeded(event.data.object);
        break;

      case 'charge.failed':
        await handleChargeFailed(event.data.object);
        break;

      case 'charge.dispute.created':
        await handleChargeDisputeCreated(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle subscription created
async function handleSubscriptionCreated(subscription) {
  try {
    console.log('Processing subscription created:', subscription.id);

    const metadata = subscription.metadata;
    if (!metadata.donor_id || !metadata.organization_id || !metadata.package_id) {
      console.log('Missing required metadata for subscription:', subscription.id);
      return;
    }

    // Check if subscription already exists
    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripe_subscription_id: subscription.id }
    });

    if (existingSubscription) {
      console.log('Subscription already exists:', subscription.id);
      return;
    }

    // Get package details
    const packageData = await prisma.package.findUnique({
      where: { id: parseInt(metadata.package_id) }
    });

    if (!packageData) {
      console.log('Package not found:', metadata.package_id);
      return;
    }

    // Create subscription in database
    await prisma.subscription.create({
      data: {
        stripe_subscription_id: subscription.id,
        donor_id: parseInt(metadata.donor_id),
        organization_id: parseInt(metadata.organization_id),
        package_id: parseInt(metadata.package_id),
        status: subscription.status.toUpperCase(),
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        amount: packageData.price,
        currency: packageData.currency,
        interval: subscription.items.data[0]?.price?.recurring?.interval || 'month',
        interval_count: subscription.items.data[0]?.price?.recurring?.interval_count || 1,
        metadata: JSON.stringify({
          stripe_customer_id: subscription.customer,
          created_via: 'webhook',
          webhook_event: 'customer.subscription.created'
        })
      }
    });

    console.log('Subscription created successfully:', subscription.id);
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

// Handle subscription updated
async function handleSubscriptionUpdated(subscription) {
  try {
    console.log('Processing subscription updated:', subscription.id);

    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripe_subscription_id: subscription.id }
    });

    if (!existingSubscription) {
      console.log('Subscription not found in database:', subscription.id);
      return;
    }

    // Update subscription in database
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: subscription.status.toUpperCase(),
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        metadata: JSON.stringify({
          ...JSON.parse(existingSubscription.metadata || '{}'),
          updated_via: 'webhook',
          webhook_event: 'customer.subscription.updated',
          updated_at: new Date().toISOString()
        })
      }
    });

    console.log('Subscription updated successfully:', subscription.id);
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

// Handle subscription deleted
async function handleSubscriptionDeleted(subscription) {
  try {
    console.log('Processing subscription deleted:', subscription.id);

    const existingSubscription = await prisma.subscription.findFirst({
      where: { stripe_subscription_id: subscription.id }
    });

    if (!existingSubscription) {
      console.log('Subscription not found in database:', subscription.id);
      return;
    }

    // Update subscription status to canceled
    await prisma.subscription.update({
      where: { id: existingSubscription.id },
      data: {
        status: 'CANCELED',
        canceled_at: new Date(),
        metadata: JSON.stringify({
          ...JSON.parse(existingSubscription.metadata || '{}'),
          canceled_via: 'webhook',
          webhook_event: 'customer.subscription.deleted',
          canceled_at: new Date().toISOString()
        })
      }
    });

    console.log('Subscription canceled successfully:', subscription.id);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

// Handle invoice created
async function handleInvoiceCreated(invoice) {
  try {
    console.log('Processing invoice created:', invoice.id);

    if (!invoice.subscription) {
      console.log('Invoice is not for a subscription:', invoice.id);
      return;
    }

    // Find subscription in database
    const subscription = await prisma.subscription.findFirst({
      where: { stripe_subscription_id: invoice.subscription }
    });

    if (!subscription) {
      console.log('Subscription not found for invoice:', invoice.id);
      return;
    }

    // Create invoice record (optional - for tracking)
    console.log('Invoice created for subscription:', subscription.id);
  } catch (error) {
    console.error('Error handling invoice created:', error);
  }
}

// Handle invoice payment succeeded
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    console.log('Processing invoice payment succeeded:', invoice.id);

    if (!invoice.subscription) {
      console.log('Invoice is not for a subscription:', invoice.id);
      return;
    }

    // Find subscription in database
    const subscription = await prisma.subscription.findFirst({
      where: { stripe_subscription_id: invoice.subscription }
    });

    if (!subscription) {
      console.log('Subscription not found for invoice:', invoice.id);
      return;
    }

    // Create transaction record
    await prisma.subscriptionTransaction.create({
      data: {
        stripe_transaction_id: invoice.payment_intent,
        subscription_id: subscription.id,
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency,
        status: 'SUCCEEDED',
        payment_method: 'stripe',
        description: `Payment for invoice ${invoice.number}`,
        metadata: JSON.stringify({
          invoice_id: invoice.id,
          invoice_number: invoice.number,
          payment_intent_id: invoice.payment_intent,
          created_via: 'webhook',
          webhook_event: 'invoice.payment_succeeded'
        })
      }
    });

    console.log('Payment transaction recorded successfully:', invoice.id);
  } catch (error) {
    console.error('Error handling invoice payment succeeded:', error);
  }
}

// Handle invoice payment failed
async function handleInvoicePaymentFailed(invoice) {
  try {
    console.log('Processing invoice payment failed:', invoice.id);

    if (!invoice.subscription) {
      console.log('Invoice is not for a subscription:', invoice.id);
      return;
    }

    // Find subscription in database
    const subscription = await prisma.subscription.findFirst({
      where: { stripe_subscription_id: invoice.subscription }
    });

    if (!subscription) {
      console.log('Subscription not found for invoice:', invoice.id);
      return;
    }

    // Create failed transaction record
    await prisma.subscriptionTransaction.create({
      data: {
        stripe_transaction_id: invoice.payment_intent || `failed_${invoice.id}`,
        subscription_id: subscription.id,
        amount: invoice.amount_due / 100, // Convert from cents
        currency: invoice.currency,
        status: 'FAILED',
        payment_method: 'stripe',
        description: `Failed payment for invoice ${invoice.number}`,
        metadata: JSON.stringify({
          invoice_id: invoice.id,
          invoice_number: invoice.number,
          payment_intent_id: invoice.payment_intent,
          failure_reason: 'payment_failed',
          created_via: 'webhook',
          webhook_event: 'invoice.payment_failed'
        })
      }
    });

    console.log('Failed payment transaction recorded:', invoice.id);
  } catch (error) {
    console.error('Error handling invoice payment failed:', error);
  }
}

// Handle invoice finalized
async function handleInvoiceFinalized(invoice) {
  try {
    console.log('Processing invoice finalized:', invoice.id);
    // Add any specific logic for finalized invoices
  } catch (error) {
    console.error('Error handling invoice finalized:', error);
  }
}

// Handle invoice payment action required
async function handleInvoicePaymentActionRequired(invoice) {
  try {
    console.log('Processing invoice payment action required:', invoice.id);
    // Add any specific logic for payment action required
  } catch (error) {
    console.error('Error handling invoice payment action required:', error);
  }
}

// Handle payment method attached
async function handlePaymentMethodAttached(paymentMethod) {
  try {
    console.log('Processing payment method attached:', paymentMethod.id);
    // Add any specific logic for payment method attachment
  } catch (error) {
    console.error('Error handling payment method attached:', error);
  }
}

// Handle payment method detached
async function handlePaymentMethodDetached(paymentMethod) {
  try {
    console.log('Processing payment method detached:', paymentMethod.id);
    // Add any specific logic for payment method detachment
  } catch (error) {
    console.error('Error handling payment method detached:', error);
  }
}

// Handle charge succeeded
async function handleChargeSucceeded(charge) {
  try {
    console.log('Processing charge succeeded:', charge.id);
    // Add any specific logic for successful charges
  } catch (error) {
    console.error('Error handling charge succeeded:', error);
  }
}

// Handle charge failed
async function handleChargeFailed(charge) {
  try {
    console.log('Processing charge failed:', charge.id);
    // Add any specific logic for failed charges
  } catch (error) {
    console.error('Error handling charge failed:', error);
  }
}

// Handle charge dispute created
async function handleChargeDisputeCreated(dispute) {
  try {
    console.log('Processing charge dispute created:', dispute.id);
    // Add any specific logic for charge disputes
  } catch (error) {
    console.error('Error handling charge dispute created:', error);
  }
}
