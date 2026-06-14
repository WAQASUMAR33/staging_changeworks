import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/[id]/transactions - Get subscription transactions
export async function GET(request, { params }) {
  try {
    const subscriptionId = params.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;

    // Verify subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscriptionId) },
      select: { id: true, stripe_subscription_id: true }
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Get transactions from database
    const transactions = await prisma.subscriptionTransaction.findMany({
      where: { subscription_id: parseInt(subscriptionId) },
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.subscriptionTransaction.count({
      where: { subscription_id: parseInt(subscriptionId) }
    });

    // Get Stripe invoices for additional data
    let stripeInvoices = [];
    try {
      const stripeInvoicesResponse = await stripe.invoices.list({
        subscription: subscription.stripe_subscription_id,
        limit: 100
      });
      stripeInvoices = stripeInvoicesResponse.data;
    } catch (stripeError) {
      console.warn('Could not fetch Stripe invoices:', stripeError.message);
    }

    // Merge database transactions with Stripe invoice data
    const enrichedTransactions = transactions.map(transaction => {
      const stripeInvoice = stripeInvoices.find(
        invoice => invoice.id === transaction.stripe_invoice_id
      );

      return {
        ...transaction,
        stripe_invoice: stripeInvoice ? {
          id: stripeInvoice.id,
          number: stripeInvoice.number,
          status: stripeInvoice.status,
          paid: stripeInvoice.paid,
          amount_paid: stripeInvoice.amount_paid,
          amount_due: stripeInvoice.amount_due,
          currency: stripeInvoice.currency,
          created: new Date(stripeInvoice.created * 1000),
          due_date: stripeInvoice.due_date ? new Date(stripeInvoice.due_date * 1000) : null,
          hosted_invoice_url: stripeInvoice.hosted_invoice_url,
          invoice_pdf: stripeInvoice.invoice_pdf,
          payment_intent: stripeInvoice.payment_intent
        } : null
      };
    });

    return NextResponse.json({
      success: true,
      transactions: enrichedTransactions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      },
      subscription: {
        id: subscription.id,
        stripe_subscription_id: subscription.stripe_subscription_id
      }
    });

  } catch (error) {
    console.error('Error fetching subscription transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription transactions' },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions/[id]/transactions - Create manual transaction record
export async function POST(request, { params }) {
  try {
    const subscriptionId = params.id;
    const body = await request.json();
    const {
      stripe_invoice_id,
      amount,
      currency = 'USD',
      status = 'paid',
      invoice_url,
      hosted_invoice_url,
      pdf_url,
      period_start,
      period_end
    } = body;

    // Validate required fields
    if (!stripe_invoice_id || !amount || !period_start || !period_end) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: stripe_invoice_id, amount, period_start, period_end' },
        { status: 400 }
      );
    }

    // Verify subscription exists
    const subscription = await prisma.subscription.findUnique({
      where: { id: parseInt(subscriptionId) },
      select: { id: true, stripe_subscription_id: true }
    });

    if (!subscription) {
      return NextResponse.json(
        { success: false, error: 'Subscription not found' },
        { status: 404 }
      );
    }

    // Check if transaction already exists
    const existingTransaction = await prisma.subscriptionTransaction.findUnique({
      where: { stripe_invoice_id }
    });

    if (existingTransaction) {
      return NextResponse.json(
        { success: false, error: 'Transaction with this invoice ID already exists' },
        { status: 409 }
      );
    }

    // Create transaction record
    const transaction = await prisma.subscriptionTransaction.create({
      data: {
        subscription_id: parseInt(subscriptionId),
        stripe_invoice_id,
        amount: parseFloat(amount),
        currency: currency.toUpperCase(),
        status,
        invoice_url,
        hosted_invoice_url,
        pdf_url,
        period_start: new Date(period_start),
        period_end: new Date(period_end)
      }
    });

    return NextResponse.json({
      success: true,
      transaction,
      message: 'Transaction record created successfully'
    });

  } catch (error) {
    console.error('Error creating subscription transaction:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription transaction' },
      { status: 500 }
    );
  }
}