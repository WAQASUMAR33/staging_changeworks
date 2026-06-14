import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/billing - Get billing information for a subscription
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const subscriptionId = searchParams.get('subscription_id');
    const donorId = searchParams.get('donor_id');

    if (!subscriptionId && !donorId) {
      return NextResponse.json(
        { success: false, error: 'Either subscription_id or donor_id is required' },
        { status: 400 }
      );
    }

    let subscription;
    let stripeSubscription;

    if (subscriptionId) {
      // Get subscription by ID
      subscription = await prisma.subscription.findUnique({
        where: { id: parseInt(subscriptionId) },
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

      // Get Stripe subscription details
      stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    } else {
      // Get subscription by donor ID (get the most recent active subscription)
      subscription = await prisma.subscription.findFirst({
        where: { 
          donor_id: parseInt(donorId),
          status: 'ACTIVE'
        },
        include: {
          donor: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
          package: { select: { id: true, name: true, price: true, currency: true } }
        },
        orderBy: { created_at: 'desc' }
      });

      if (!subscription) {
        return NextResponse.json(
          { success: false, error: 'No active subscription found for this donor' },
          { status: 404 }
        );
      }

      // Get Stripe subscription details
      stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
    }

    // Get upcoming invoice
    let upcomingInvoice = null;
    try {
      upcomingInvoice = await stripe.invoices.retrieveUpcoming({
        customer: stripeSubscription.customer,
        subscription: stripeSubscription.id
      });
    } catch (error) {
      console.log('No upcoming invoice found:', error.message);
    }

    // Get recent invoices
    const recentInvoices = await stripe.invoices.list({
      customer: stripeSubscription.customer,
      subscription: stripeSubscription.id,
      limit: 5
    });

    // Get payment method details
    let defaultPaymentMethod = null;
    if (stripeSubscription.default_payment_method) {
      defaultPaymentMethod = await stripe.paymentMethods.retrieve(stripeSubscription.default_payment_method);
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        amount: subscription.amount,
        currency: subscription.currency,
        interval: subscription.interval,
        donor: subscription.donor,
        organization: subscription.organization,
        package: subscription.package
      },
      billing: {
        customer_id: stripeSubscription.customer,
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        next_billing_date: new Date(stripeSubscription.current_period_end * 1000),
        billing_cycle_anchor: new Date(stripeSubscription.billing_cycle_anchor * 1000),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
        trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null
      },
      payment_method: defaultPaymentMethod ? {
        id: defaultPaymentMethod.id,
        type: defaultPaymentMethod.type,
        card: {
          brand: defaultPaymentMethod.card.brand,
          last4: defaultPaymentMethod.card.last4,
          exp_month: defaultPaymentMethod.card.exp_month,
          exp_year: defaultPaymentMethod.card.exp_year
        }
      } : null,
      upcoming_invoice: upcomingInvoice ? {
        id: upcomingInvoice.id,
        amount_due: upcomingInvoice.amount_due / 100, // Convert from cents
        currency: upcomingInvoice.currency,
        period_start: new Date(upcomingInvoice.period_start * 1000),
        period_end: new Date(upcomingInvoice.period_end * 1000),
        due_date: upcomingInvoice.due_date ? new Date(upcomingInvoice.due_date * 1000) : null
      } : null,
      recent_invoices: recentInvoices.data.map(invoice => ({
        id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount_paid: invoice.amount_paid / 100, // Convert from cents
        amount_due: invoice.amount_due / 100, // Convert from cents
        currency: invoice.currency,
        created: new Date(invoice.created * 1000),
        due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        paid_at: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
        hosted_invoice_url: invoice.hosted_invoice_url,
        invoice_pdf: invoice.invoice_pdf
      }))
    });

  } catch (error) {
    console.error('Error fetching billing information:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch billing information' },
      { status: 500 }
    );
  }
}

// PUT /api/subscriptions/billing - Update billing information
export async function PUT(request) {
  try {
    const body = await request.json();
    const {
      subscription_id,
      payment_method_id,
      billing_cycle_anchor,
      proration_behavior = 'create_prorations'
    } = body;

    if (!subscription_id) {
      return NextResponse.json(
        { success: false, error: 'subscription_id is required' },
        { status: 400 }
      );
    }

    // Get subscription from database
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

    // Prepare update data for Stripe
    const updateData = {};

    if (payment_method_id) {
      updateData.default_payment_method = payment_method_id;
    }

    if (billing_cycle_anchor) {
      updateData.billing_cycle_anchor = Math.floor(new Date(billing_cycle_anchor).getTime() / 1000);
      updateData.proration_behavior = proration_behavior;
    }

    // Update Stripe subscription
    const stripeSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      updateData
    );

    // Update database if needed
    if (payment_method_id) {
      await prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          metadata: JSON.stringify({
            ...JSON.parse(subscription.metadata || '{}'),
            default_payment_method: payment_method_id,
            updated_at: new Date().toISOString()
          })
        }
      });
    }

    return NextResponse.json({
      success: true,
      subscription: {
        id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id,
        status: stripeSubscription.status.toUpperCase(),
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        billing_cycle_anchor: new Date(stripeSubscription.billing_cycle_anchor * 1000),
        default_payment_method: stripeSubscription.default_payment_method
      },
      message: 'Billing information updated successfully'
    });

  } catch (error) {
    console.error('Error updating billing information:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update billing information' },
      { status: 500 }
    );
  }
}
