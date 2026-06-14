import { NextResponse } from "next/server";
import Stripe from 'stripe';
import { prisma } from "../../../../lib/prisma";

// Initialize Stripe with proper error handling
let stripe;
try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY environment variable is not set');
  } else {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error);
}

// GET - Get subscription invoices
export async function GET(request, { params }) {
  try {
    const subscriptionId = parseInt(params.id);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit')) || 10;
    const status = searchParams.get('status'); // paid, open, void, uncollectible

    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: "Payment service not available",
        details: "Stripe configuration is missing"
      }, { status: 503 });
    }

    // Verify subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { 
        id: true, 
        stripe_subscription_id: true,
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
        }
      }
    });

    if (!subscription) {
      return NextResponse.json({
        success: false,
        error: "Subscription not found"
      }, { status: 404 });
    }

    // Get Stripe invoices
    const invoiceParams = {
      subscription: subscription.stripe_subscription_id,
      limit: limit
    };

    if (status) {
      invoiceParams.status = status;
    }

    const invoices = await stripe.invoices.list(invoiceParams);

    // Get database transaction records for these invoices
    const invoiceIds = invoices.data.map(inv => inv.id);
    const dbTransactions = await prisma.subscriptionTransaction.findMany({
      where: {
        subscription_id: subscriptionId,
        stripe_invoice_id: {
          in: invoiceIds
        }
      }
    });

    // Merge Stripe invoices with database data
    const enrichedInvoices = invoices.data.map(invoice => {
      const dbTransaction = dbTransactions.find(t => t.stripe_invoice_id === invoice.id);
      return {
        id: invoice.id,
        amount_paid: invoice.amount_paid / 100, // Convert from cents
        amount_due: invoice.amount_due / 100,
        currency: invoice.currency,
        status: invoice.status,
        invoice_pdf: invoice.invoice_pdf,
        hosted_invoice_url: invoice.hosted_invoice_url,
        period_start: new Date(invoice.period_start * 1000),
        period_end: new Date(invoice.period_end * 1000),
        created: new Date(invoice.created * 1000),
        due_date: invoice.due_date ? new Date(invoice.due_date * 1000) : null,
        paid_at: invoice.status_transitions?.paid_at ? new Date(invoice.status_transitions.paid_at * 1000) : null,
        subscription: {
          id: subscription.id,
          donor: subscription.donor,
          organization: subscription.organization
        },
        database_record: dbTransaction
      };
    });

    return NextResponse.json({
      success: true,
      invoices: enrichedInvoices,
      has_more: invoices.has_more,
      total_count: invoices.data.length
    });

  } catch (error) {
    console.error('Error fetching subscription invoices:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch subscription invoices",
      details: error.message
    }, { status: 500 });
  }
}

// POST - Create upcoming invoice preview
export async function POST(request, { params }) {
  try {
    const subscriptionId = parseInt(params.id);

    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: "Payment service not available",
        details: "Stripe configuration is missing"
      }, { status: 503 });
    }

    // Verify subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      select: { 
        id: true, 
        stripe_subscription_id: true,
        donor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!subscription) {
      return NextResponse.json({
        success: false,
        error: "Subscription not found"
      }, { status: 404 });
    }

    // Get upcoming invoice from Stripe
    const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
      subscription: subscription.stripe_subscription_id
    });

    return NextResponse.json({
      success: true,
      upcoming_invoice: {
        id: upcomingInvoice.id,
        amount_due: upcomingInvoice.amount_due / 100, // Convert from cents
        currency: upcomingInvoice.currency,
        period_start: new Date(upcomingInvoice.period_start * 1000),
        period_end: new Date(upcomingInvoice.period_end * 1000),
        subtotal: upcomingInvoice.subtotal / 100,
        tax: upcomingInvoice.tax / 100,
        total: upcomingInvoice.total / 100,
        lines: upcomingInvoice.lines.data.map(line => ({
          id: line.id,
          description: line.description,
          amount: line.amount / 100,
          currency: line.currency,
          period_start: new Date(line.period.start * 1000),
          period_end: new Date(line.period.end * 1000)
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching upcoming invoice:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch upcoming invoice",
      details: error.message
    }, { status: 500 });
  }
}
