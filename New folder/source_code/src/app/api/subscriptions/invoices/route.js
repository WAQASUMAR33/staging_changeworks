import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/invoices - Get invoices for subscriptions
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

    let subscriptions = [];
    let stripeInvoices = [];

    if (subscriptionId) {
      // Get specific subscription
      const subscription = await prisma.subscription.findUnique({
        where: { id: parseInt(subscriptionId) },
        include: {
          donor: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
          package: { select: { id: true, name: true, price: true, currency: true } }
        }
      });

      if (subscription) {
        subscriptions = [subscription];
      }
    } else if (donorId) {
      // Get subscriptions for donor
      subscriptions = await prisma.subscription.findMany({
        where: { donor_id: parseInt(donorId) },
        include: {
          donor: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
          package: { select: { id: true, name: true, price: true, currency: true } }
        }
      });
    } else if (organizationId) {
      // Get subscriptions for organization
      subscriptions = await prisma.subscription.findMany({
        where: { organization_id: parseInt(organizationId) },
        include: {
          donor: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
          package: { select: { id: true, name: true, price: true, currency: true } }
        }
      });
    } else {
      // Get all subscriptions
      subscriptions = await prisma.subscription.findMany({
        include: {
          donor: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
          package: { select: { id: true, name: true, price: true, currency: true } }
        },
        skip,
        take: limit
      });
    }

    // Get Stripe invoices for these subscriptions
    if (subscriptions.length > 0) {
      const stripeSubscriptionIds = subscriptions.map(s => s.stripe_subscription_id);
      
      for (const stripeSubscriptionId of stripeSubscriptionIds) {
        try {
          const invoices = await stripe.invoices.list({
            subscription: stripeSubscriptionId,
            limit: 50
          });

          // Filter by status if provided
          if (status) {
            stripeInvoices.push(...invoices.data.filter(invoice => invoice.status === status));
          } else {
            stripeInvoices.push(...invoices.data);
          }
        } catch (error) {
          console.log(`Error fetching invoices for subscription ${stripeSubscriptionId}:`, error.message);
        }
      }
    }

    // Sort invoices by creation date (newest first)
    stripeInvoices.sort((a, b) => b.created - a.created);

    // Apply pagination to Stripe invoices
    const paginatedInvoices = stripeInvoices.slice(skip, skip + limit);

    return NextResponse.json({
      success: true,
      invoices: paginatedInvoices.map(invoice => {
        // Find the corresponding subscription
        const subscription = subscriptions.find(s => s.stripe_subscription_id === invoice.subscription);
        
        return {
          id: invoice.id,
          number: invoice.number,
          status: invoice.status,
          amount_paid: invoice.amount_paid / 100, // Convert from cents
          amount_due: invoice.amount_due / 100, // Convert from cents
          total: invoice.total / 100, // Convert from cents
          subtotal: invoice.subtotal / 100, // Convert from cents
          tax: invoice.tax / 100, // Convert from cents
          currency: invoice.currency,
          created: new Date(invoice.created * 1000),
          due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
          paid_at: invoice.status_transitions.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
          period_start: new Date(invoice.period_start * 1000),
          period_end: new Date(invoice.period_end * 1000),
          hosted_invoice_url: invoice.hosted_invoice_url,
          invoice_pdf: invoice.invoice_pdf,
          subscription: subscription ? {
            id: subscription.id,
            stripe_subscription_id: subscription.stripe_subscription_id,
            status: subscription.status,
            donor: subscription.donor,
            organization: subscription.organization,
            package: subscription.package
          } : null,
          line_items: invoice.lines.data.map(item => ({
            id: item.id,
            description: item.description,
            amount: item.amount / 100, // Convert from cents
            currency: item.currency,
            quantity: item.quantity,
            period_start: new Date(item.period.start * 1000),
            period_end: new Date(item.period.end * 1000)
          }))
        };
      }),
      pagination: {
        page,
        limit,
        total: stripeInvoices.length,
        pages: Math.ceil(stripeInvoices.length / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subscription invoices:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription invoices' },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions/invoices - Create a manual invoice
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      subscription_id,
      amount,
      currency = 'USD',
      description,
      due_date,
      metadata = {}
    } = body;

    if (!subscription_id || !amount) {
      return NextResponse.json(
        { success: false, error: 'subscription_id and amount are required' },
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

    // Create invoice in Stripe
    const invoiceData = {
      customer: customerId,
      subscription: subscription.stripe_subscription_id,
      description: description || `Manual invoice for subscription ${subscription.stripe_subscription_id}`,
      metadata: {
        subscription_id: subscription.stripe_subscription_id,
        donor_id: subscription.donor_id.toString(),
        organization_id: subscription.organization_id.toString(),
        ...metadata
      }
    };

    if (due_date) {
      invoiceData.due_date = Math.floor(new Date(due_date).getTime() / 1000);
    }

    const invoice = await stripe.invoices.create(invoiceData);

    // Add line item to the invoice
    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: Math.round(amount * 100), // Convert to cents
      currency: currency.toLowerCase(),
      description: description || 'Manual invoice item'
    });

    // Finalize the invoice
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);

    return NextResponse.json({
      success: true,
      invoice: {
        id: finalizedInvoice.id,
        number: finalizedInvoice.number,
        status: finalizedInvoice.status,
        amount_due: finalizedInvoice.amount_due / 100, // Convert from cents
        total: finalizedInvoice.total / 100, // Convert from cents
        currency: finalizedInvoice.currency,
        created: new Date(finalizedInvoice.created * 1000),
        due_date: finalizedInvoice.due_date ? new Date(finalizedInvoice.due_date * 1000) : null,
        hosted_invoice_url: finalizedInvoice.hosted_invoice_url,
        invoice_pdf: finalizedInvoice.invoice_pdf,
        subscription: {
          id: subscription.id,
          stripe_subscription_id: subscription.stripe_subscription_id,
          status: subscription.status,
          donor: subscription.donor,
          organization: subscription.organization,
          package: subscription.package
        }
      },
      message: 'Invoice created successfully'
    });

  } catch (error) {
    console.error('Error creating subscription invoice:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription invoice' },
      { status: 500 }
    );
  }
}
