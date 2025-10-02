import { NextResponse } from "next/server";
import Stripe from 'stripe';
import { prisma } from "../../../lib/prisma";
import emailService from "../../../lib/email-service";

// Initialize Stripe with proper error handling
let stripe;
let endpointSecret;

try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY environment variable is not set');
  } else {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
  
  endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    console.warn('STRIPE_WEBHOOK_SECRET environment variable is not set');
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error);
}

export async function POST(request) {
  try {
    // Check if Stripe is properly initialized
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

    // Handle the event
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object);
        break;
      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event.data.object);
        break;
      case 'payment_intent.processing':
        await handlePaymentIntentProcessing(event.data.object);
        break;
      // Subscription events
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;
      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case 'invoice.created':
        await handleInvoiceCreated(event.data.object);
        break;
      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({
      error: 'Webhook handler failed'
    }, { status: 500 });
  }
}

async function handlePaymentIntentSucceeded(paymentIntent) {
  try {
    console.log('Payment succeeded:', paymentIntent.id);

    const donorId = parseInt(paymentIntent.metadata.donor_id);
    const organizationId = parseInt(paymentIntent.metadata.organization_id);
    const amount = paymentIntent.amount_received / 100; // Convert from cents

    // Update transaction record
    await prisma.saveTrRecord.updateMany({
      where: {
        trx_details: {
          contains: paymentIntent.id
        }
      },
      data: {
        pay_status: 'completed',
        trx_recipt_url: paymentIntent.receipt_url,
        trx_details: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          stripe_payment_method: paymentIntent.payment_method,
          stripe_status: paymentIntent.status,
          stripe_amount_received: paymentIntent.amount_received,
          stripe_created: new Date(paymentIntent.created * 1000),
          webhook_processed_at: new Date()
        }),
        updated_at: new Date()
      }
    });

    // Update organization balance
    await prisma.organization.update({
      where: { id: organizationId },
      data: {
        balance: {
          increment: amount
        }
      }
    });

    console.log(`Updated organization ${organizationId} balance by $${amount}`);

    // Send monthly impact email to donor
    try {
      await sendMonthlyImpactEmail(donorId, organizationId, amount);
    } catch (emailError) {
      console.error('Failed to send monthly impact email:', emailError);
      // Don't fail the webhook if email fails
    }

  } catch (error) {
    console.error('Error handling payment_intent.succeeded:', error);
  }
}

async function handlePaymentIntentFailed(paymentIntent) {
  try {
    console.log('Payment failed:', paymentIntent.id);

    // Update transaction record
    await prisma.saveTrRecord.updateMany({
      where: {
        trx_details: {
          contains: paymentIntent.id
        }
      },
      data: {
        pay_status: 'failed',
        trx_details: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          stripe_status: paymentIntent.status,
          stripe_last_payment_error: paymentIntent.last_payment_error,
          webhook_processed_at: new Date()
        }),
        updated_at: new Date()
      }
    });

    // Send card failure alert email if donor and organization info available
    try {
      const donorId = parseInt(paymentIntent.metadata.donor_id);
      const organizationId = parseInt(paymentIntent.metadata.organization_id);
      
      if (donorId && organizationId) {
        await sendCardFailureAlertEmail(donorId, organizationId);
      }
    } catch (emailError) {
      console.error('Failed to send card failure alert email:', emailError);
      // Don't fail the webhook if email fails
    }

  } catch (error) {
    console.error('Error handling payment_intent.payment_failed:', error);
  }
}

async function handlePaymentIntentCanceled(paymentIntent) {
  try {
    console.log('Payment canceled:', paymentIntent.id);

    // Update transaction record
    await prisma.saveTrRecord.updateMany({
      where: {
        trx_details: {
          contains: paymentIntent.id
        }
      },
      data: {
        pay_status: 'cancelled',
        trx_details: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          stripe_status: paymentIntent.status,
          webhook_processed_at: new Date()
        }),
        updated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error handling payment_intent.canceled:', error);
  }
}

async function handlePaymentIntentProcessing(paymentIntent) {
  try {
    console.log('Payment processing:', paymentIntent.id);

    // Update transaction record
    await prisma.saveTrRecord.updateMany({
      where: {
        trx_details: {
          contains: paymentIntent.id
        }
      },
      data: {
        pay_status: 'pending',
        trx_details: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          stripe_status: paymentIntent.status,
          webhook_processed_at: new Date()
        }),
        updated_at: new Date()
      }
    });

  } catch (error) {
    console.error('Error handling payment_intent.processing:', error);
  }
}

// Subscription event handlers
async function handleSubscriptionCreated(subscription) {
  try {
    console.log('Subscription created:', subscription.id);

    const donorId = parseInt(subscription.metadata.donor_id);
    const organizationId = parseInt(subscription.metadata.organization_id);
    const packageId = parseInt(subscription.metadata.package_id);
    const productId = subscription.metadata.product_id;
    const priceId = subscription.metadata.price_id;

    // Get package details for amount and currency
    let packageData;
    if (packageId) {
      packageData = await prisma.package.findUnique({
        where: { id: packageId }
      });
    }

    // If no package found, get amount from Stripe price
    let amount = 0;
    let currency = 'usd';
    let interval = 'month';
    let intervalCount = 1;

    if (packageData) {
      amount = packageData.price;
      currency = packageData.currency;
    } else if (priceId) {
      try {
        const stripePrice = await stripe.prices.retrieve(priceId);
        amount = stripePrice.unit_amount / 100; // Convert from cents
        currency = stripePrice.currency;
        interval = stripePrice.recurring?.interval || 'month';
        intervalCount = stripePrice.recurring?.interval_count || 1;
      } catch (stripeError) {
        console.error('Failed to retrieve Stripe price:', stripeError);
        // Use default values
        amount = 0;
        currency = 'usd';
      }
    }

    if (!packageData && !priceId) {
      console.error(`No package or price found for subscription ${subscription.id}`);
      return;
    }

    // Create or update subscription record
    const subscriptionData = {
      stripe_subscription_id: subscription.id,
      donor_id: donorId,
      organization_id: organizationId,
      package_id: packageId || 1, // Default package ID if not provided
      status: subscription.status.toUpperCase(),
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      cancel_at_period_end: subscription.cancel_at_period_end,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
      trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      amount: amount,
      currency: currency,
      interval: interval,
      interval_count: intervalCount,
      metadata: JSON.stringify({
        stripe_customer_id: subscription.customer,
        stripe_product_id: productId,
        stripe_price_id: priceId,
        created_via: 'webhook',
        webhook_processed_at: new Date()
      })
    };

    // Use upsert to create or update
    const dbSubscription = await prisma.subscription.upsert({
      where: {
        stripe_subscription_id: subscription.id
      },
      update: {
        status: subscription.status.toUpperCase(),
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        updated_at: new Date()
      },
      create: subscriptionData
    });

    console.log(`✅ Subscription ${subscription.id} created/updated in database with ID: ${dbSubscription.id}`);

  } catch (error) {
    console.error('Error handling customer.subscription.created:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    console.log('Subscription updated:', subscription.id);

    // Determine the correct status based on Stripe data
    let status = subscription.status.toUpperCase();
    
    // If subscription is canceled at period end, set appropriate status
    if (subscription.cancel_at_period_end && subscription.status === 'active') {
      status = 'CANCELED_AT_PERIOD_END';
    }
    
    // If subscription is canceled, ensure status is CANCELED
    if (subscription.status === 'canceled') {
      status = 'CANCELED';
    }

    // Update subscription record
    await prisma.subscription.updateMany({
      where: {
        stripe_subscription_id: subscription.id
      },
      data: {
        status: status,
        current_period_start: new Date(subscription.current_period_start * 1000),
        current_period_end: new Date(subscription.current_period_end * 1000),
        cancel_at_period_end: subscription.cancel_at_period_end,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null,
        trial_start: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
        trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
        updated_at: new Date()
      }
    });

    console.log(`Updated subscription ${subscription.id} status to ${subscription.status}`);

  } catch (error) {
    console.error('Error handling customer.subscription.updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    console.log('Subscription deleted:', subscription.id);

    // Update subscription record
    await prisma.subscription.updateMany({
      where: {
        stripe_subscription_id: subscription.id
      },
      data: {
        status: 'CANCELED',
        canceled_at: new Date(),
        updated_at: new Date()
      }
    });

    console.log(`Marked subscription ${subscription.id} as canceled`);

  } catch (error) {
    console.error('Error handling customer.subscription.deleted:', error);
  }
}

async function handleInvoicePaymentSucceeded(invoice) {
  try {
    console.log('Invoice payment succeeded:', invoice.id);

    if (!invoice.subscription) {
      console.log('Invoice is not for a subscription, skipping');
      return;
    }

    // Find subscription in database
    const subscription = await prisma.subscription.findFirst({
      where: {
        stripe_subscription_id: invoice.subscription
      }
    });

    if (!subscription) {
      console.log(`Subscription not found for invoice ${invoice.id}`);
      return;
    }

    // Create or update subscription transaction record
    await prisma.subscriptionTransaction.upsert({
      where: {
        stripe_invoice_id: invoice.id
      },
      update: {
        status: 'paid',
        invoice_url: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
        pdf_url: invoice.invoice_pdf,
        updated_at: new Date()
      },
      create: {
        subscription_id: subscription.id,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_paid / 100, // Convert from cents
        currency: invoice.currency,
        status: 'paid',
        invoice_url: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
        pdf_url: invoice.invoice_pdf,
        period_start: new Date(invoice.period_start * 1000),
        period_end: new Date(invoice.period_end * 1000)
      }
    });

    // Update organization balance
    const amount = invoice.amount_paid / 100;
    await prisma.organization.update({
      where: { id: subscription.organization_id },
      data: {
        balance: {
          increment: amount
        }
      }
    });

    // Create transaction record in SaveTrRecord table for recurring payment
    const transactionRecord = await prisma.saveTrRecord.create({
      data: {
        trx_id: `sub_${invoice.subscription}_${invoice.id}_${Date.now()}`,
        trx_date: new Date(),
        trx_amount: amount,
        trx_method: 'stripe_subscription_recurring',
        trx_donor_id: subscription.donor_id,
        trx_organization_id: subscription.organization_id,
        pay_status: 'completed',
        trx_recipt_url: invoice.hosted_invoice_url || null,
        trx_details: JSON.stringify({
          subscription_id: invoice.subscription,
          invoice_id: invoice.id,
          payment_intent_id: invoice.payment_intent,
          stripe_customer_id: invoice.customer,
          subscription_status: 'active',
          period_start: new Date(invoice.period_start * 1000),
          period_end: new Date(invoice.period_end * 1000),
          created_via: 'webhook_recurring_payment',
          created_at: new Date()
        })
      }
    });

    // Create donor transaction record for recurring payment
    const donorTransaction = await prisma.donorTransaction.create({
      data: {
        donor_id: subscription.donor_id,
        organization_id: subscription.organization_id,
        amount: amount,
        currency: invoice.currency,
        transaction_type: 'subscription_recurring',
        status: 'completed',
        stripe_subscription_id: invoice.subscription,
        stripe_invoice_id: invoice.id,
        stripe_payment_intent_id: invoice.payment_intent,
        description: `Recurring subscription payment: ${invoice.subscription}`,
        metadata: JSON.stringify({
          subscription_id: subscription.id,
          save_tr_record_id: transactionRecord.id,
          invoice_id: invoice.id,
          period_start: new Date(invoice.period_start * 1000),
          period_end: new Date(invoice.period_end * 1000),
          created_via: 'webhook_recurring_payment'
        })
      }
    });

    console.log(`✅ Recurring subscription payment processed:`);
    console.log(`   - Subscription ID: ${subscription.id}`);
    console.log(`   - Transaction ID: ${transactionRecord.id}`);
    console.log(`   - Donor Transaction ID: ${donorTransaction.id}`);
    console.log(`   - Amount: $${amount}`);
    console.log(`Updated organization ${subscription.organization_id} balance by $${amount} from subscription payment`);

    // Send monthly impact email to donor
    try {
      await sendMonthlyImpactEmail(subscription.donor_id, subscription.organization_id, amount);
    } catch (emailError) {
      console.error('Failed to send monthly impact email:', emailError);
      // Don't fail the webhook if email fails
    }

  } catch (error) {
    console.error('Error handling invoice.payment_succeeded:', error);
  }
}

async function handleInvoicePaymentFailed(invoice) {
  try {
    console.log('Invoice payment failed:', invoice.id);

    if (!invoice.subscription) {
      console.log('Invoice is not for a subscription, skipping');
      return;
    }

    // Find subscription in database
    const subscription = await prisma.subscription.findFirst({
      where: {
        stripe_subscription_id: invoice.subscription
      }
    });

    if (!subscription) {
      console.log(`Subscription not found for invoice ${invoice.id}`);
      return;
    }

    // Create or update subscription transaction record
    await prisma.subscriptionTransaction.upsert({
      where: {
        stripe_invoice_id: invoice.id
      },
      update: {
        status: 'failed',
        updated_at: new Date()
      },
      create: {
        subscription_id: subscription.id,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_due / 100, // Convert from cents
        currency: invoice.currency,
        status: 'failed',
        period_start: new Date(invoice.period_start * 1000),
        period_end: new Date(invoice.period_end * 1000)
      }
    });

    console.log(`Recorded failed payment for subscription ${subscription.id}`);

    // Send card failure alert email for subscription payment failure
    try {
      await sendCardFailureAlertEmail(subscription.donor_id, subscription.organization_id);
    } catch (emailError) {
      console.error('Failed to send card failure alert email:', emailError);
      // Don't fail the webhook if email fails
    }

  } catch (error) {
    console.error('Error handling invoice.payment_failed:', error);
  }
}

async function handleInvoiceCreated(invoice) {
  try {
    console.log('Invoice created:', invoice.id);

    if (!invoice.subscription) {
      console.log('Invoice is not for a subscription, skipping');
      return;
    }

    // Find subscription in database
    const subscription = await prisma.subscription.findFirst({
      where: {
        stripe_subscription_id: invoice.subscription
      }
    });

    if (!subscription) {
      console.log(`Subscription not found for invoice ${invoice.id}`);
      return;
    }

    // Create subscription transaction record
    await prisma.subscriptionTransaction.upsert({
      where: {
        stripe_invoice_id: invoice.id
      },
      update: {
        status: invoice.status,
        invoice_url: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
        pdf_url: invoice.invoice_pdf,
        updated_at: new Date()
      },
      create: {
        subscription_id: subscription.id,
        stripe_invoice_id: invoice.id,
        amount: invoice.amount_due / 100, // Convert from cents
        currency: invoice.currency,
        status: invoice.status,
        invoice_url: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
        pdf_url: invoice.invoice_pdf,
        period_start: new Date(invoice.period_start * 1000),
        period_end: new Date(invoice.period_end * 1000)
      }
    });

    console.log(`Created transaction record for invoice ${invoice.id}`);

  } catch (error) {
    console.error('Error handling invoice.created:', error);
  }
}

// Helper function to send monthly impact email
async function sendMonthlyImpactEmail(donorId, organizationId, amount) {
  try {
    // Get current month name
    const currentDate = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    const currentMonth = monthNames[currentDate.getMonth()];

    // Fetch donor and organization information
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
      console.log('Donor or organization not found for monthly impact email');
      return;
    }

    // Generate dashboard link
    const dashboardLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/donor/dashboard?donor_id=${donor.id}`;

    // Send monthly impact email
    const emailResult = await emailService.sendMonthlyImpactEmail({
      donor: {
        name: donor.name,
        email: donor.email
      },
      organization: organization,
      dashboardLink: dashboardLink,
      month: currentMonth,
      totalAmount: amount.toFixed(2)
    });

    if (emailResult.success) {
      console.log(`✅ Monthly impact email sent to ${donor.email} for $${amount} in ${currentMonth}`);
    } else {
      console.error(`❌ Failed to send monthly impact email to ${donor.email}:`, emailResult.error);
    }

  } catch (error) {
    console.error('Error sending monthly impact email:', error);
  }
}

// Helper function to send card failure alert email
async function sendCardFailureAlertEmail(donorId, organizationId) {
  try {
    // Fetch donor and organization information
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
      console.log('Donor or organization not found for card failure alert email');
      return;
    }

    // Generate dashboard link
    const dashboardLink = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/donor/dashboard?donor_id=${donor.id}`;

    // Send card failure alert email
    const emailResult = await emailService.sendCardFailureAlertEmail({
      donor: {
        name: donor.name,
        email: donor.email
      },
      organization: organization,
      dashboardLink: dashboardLink
    });

    if (emailResult.success) {
      console.log(`✅ Card failure alert email sent to ${donor.email} for ${organization.name}`);
    } else {
      console.error(`❌ Failed to send card failure alert email to ${donor.email}:`, emailResult.error);
    }

  } catch (error) {
    console.error('Error sending card failure alert email:', error);
  }
}
