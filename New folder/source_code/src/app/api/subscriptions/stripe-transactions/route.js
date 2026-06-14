import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma.jsx";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/stripe-transactions - Get Stripe transactions by donor email
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get('donor_id');
    const customerEmail = searchParams.get('customer_email');

    // Validate required parameters
    if (!donorId && !customerEmail) {
      return NextResponse.json(
        { success: false, error: 'Either donor_id or customer_email is required' },
        { status: 400 }
      );
    }

    let donor = null;
    let email = customerEmail;

    // Get donor information if donor_id is provided
    if (donorId) {
      donor = await prisma.donor.findUnique({
        where: { id: parseInt(donorId) },
        select: {
          id: true,
          name: true,
          email: true
        }
      });

      if (!donor) {
        return NextResponse.json(
          { success: false, error: 'Donor not found' },
          { status: 404 }
        );
      }

      email = donor.email;
    }

    // Find Stripe customer by email
    const stripeCustomers = await stripe.customers.list({
      email: email,
      limit: 1
    });

    if (stripeCustomers.data.length === 0) {
      return NextResponse.json({
        success: true,
        donor: donor,
        customer_email: email,
        message: 'No Stripe customer found for this email',
        stripe_customer: null,
        subscriptions: [],
        invoices: [],
        payment_intents: []
      });
    }

    const stripeCustomer = stripeCustomers.data[0];

    // Get Stripe subscriptions
    const stripeSubscriptions = await stripe.subscriptions.list({
      customer: stripeCustomer.id,
      status: 'all',
      limit: 100
    });

    // Get Stripe invoices
    const stripeInvoices = await stripe.invoices.list({
      customer: stripeCustomer.id,
      limit: 100
    });

    // Get Stripe payment intents
    const stripePaymentIntents = await stripe.paymentIntents.list({
      customer: stripeCustomer.id,
      limit: 100
    });

    // Get Stripe charges
    const stripeCharges = await stripe.charges.list({
      customer: stripeCustomer.id,
      limit: 100
    });

    // Process subscriptions
    const subscriptions = stripeSubscriptions.data.map(sub => ({
      id: sub.id,
      status: sub.status,
      current_period_start: new Date(sub.current_period_start * 1000),
      current_period_end: new Date(sub.current_period_end * 1000),
      cancel_at_period_end: sub.cancel_at_period_end,
      created: new Date(sub.created * 1000),
      amount: sub.items.data[0]?.price?.unit_amount || 0,
      currency: sub.items.data[0]?.price?.currency || 'usd',
      interval: sub.items.data[0]?.price?.recurring?.interval || 'month',
      product_name: sub.items.data[0]?.price?.product?.name || 'Unknown Product'
    }));

    // Process invoices
    const invoices = stripeInvoices.data.map(invoice => ({
      id: invoice.id,
      number: invoice.number,
      status: invoice.status,
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      created: new Date(invoice.created * 1000),
      paid: invoice.paid,
      payment_intent: invoice.payment_intent,
      subscription: invoice.subscription,
      description: invoice.description || invoice.lines?.data[0]?.description || 'No description'
    }));

    // Process payment intents
    const paymentIntents = stripePaymentIntents.data.map(pi => ({
      id: pi.id,
      amount: pi.amount,
      currency: pi.currency,
      status: pi.status,
      created: new Date(pi.created * 1000),
      description: pi.description || 'No description',
      metadata: pi.metadata
    }));

    // Process charges
    const charges = stripeCharges.data.map(charge => ({
      id: charge.id,
      amount: charge.amount,
      currency: charge.currency,
      status: charge.status,
      created: new Date(charge.created * 1000),
      description: charge.description || 'No description',
      payment_intent: charge.payment_intent,
      receipt_url: charge.receipt_url
    }));

    // Calculate totals
    const totalPaid = invoices
      .filter(inv => inv.paid)
      .reduce((sum, inv) => sum + (inv.amount_paid || 0), 0);

    const totalCharges = charges
      .filter(charge => charge.status === 'succeeded')
      .reduce((sum, charge) => sum + (charge.amount || 0), 0);

    return NextResponse.json({
      success: true,
      donor: donor,
      customer_email: email,
      stripe_customer: {
        id: stripeCustomer.id,
        email: stripeCustomer.email,
        name: stripeCustomer.name,
        created: new Date(stripeCustomer.created * 1000)
      },
      subscriptions: {
        total: subscriptions.length,
        active: subscriptions.filter(s => s.status === 'active').length,
        data: subscriptions
      },
      invoices: {
        total: invoices.length,
        paid: invoices.filter(inv => inv.paid).length,
        data: invoices
      },
      payment_intents: {
        total: paymentIntents.length,
        succeeded: paymentIntents.filter(pi => pi.status === 'succeeded').length,
        data: paymentIntents
      },
      charges: {
        total: charges.length,
        succeeded: charges.filter(c => c.status === 'succeeded').length,
        data: charges
      },
      summary: {
        total_paid_from_invoices: totalPaid,
        total_charges: totalCharges,
        active_subscriptions: subscriptions.filter(s => s.status === 'active').length,
        total_transactions: invoices.length + paymentIntents.length + charges.length
      }
    });

  } catch (error) {
    console.error('Error fetching Stripe transactions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch Stripe transactions', details: error.message },
      { status: 500 }
    );
  }
}
