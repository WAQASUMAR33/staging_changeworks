import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/payment-methods - List payment methods for a customer
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const customerId = searchParams.get('customer_id');
    const donorId = searchParams.get('donor_id');

    if (!customerId && !donorId) {
      return NextResponse.json(
        { success: false, error: 'Either customer_id or donor_id is required' },
        { status: 400 }
      );
    }

    let stripeCustomerId = customerId;

    // If donor_id is provided, get the Stripe customer ID
    if (donorId && !customerId) {
      const donor = await prisma.donor.findUnique({
        where: { id: parseInt(donorId) },
        select: { id: true, email: true, name: true }
      });

      if (!donor) {
        return NextResponse.json(
          { success: false, error: 'Donor not found' },
          { status: 404 }
        );
      }

      // Find or create Stripe customer
      const existingCustomers = await stripe.customers.list({
        email: donor.email,
        limit: 1
      });

      if (existingCustomers.data.length === 0) {
        return NextResponse.json(
          { success: false, error: 'No Stripe customer found for this donor' },
          { status: 404 }
        );
      }

      stripeCustomerId = existingCustomers.data[0].id;
    }

    // Get payment methods from Stripe
    const paymentMethods = await stripe.paymentMethods.list({
      customer: stripeCustomerId,
      type: 'card'
    });

    // Get customer details
    const customer = await stripe.customers.retrieve(stripeCustomerId);

    return NextResponse.json({
      success: true,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name
      },
      payment_methods: paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: {
          brand: pm.card.brand,
          last4: pm.card.last4,
          exp_month: pm.card.exp_month,
          exp_year: pm.card.exp_year
        },
        created: pm.created
      })),
      total: paymentMethods.data.length
    });

  } catch (error) {
    console.error('Error fetching payment methods:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch payment methods' },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions/payment-methods - Create a new payment method
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      donor_id,
      organization_id,
      payment_method_id,
      set_as_default = false
    } = body;

    if (!donor_id || !payment_method_id) {
      return NextResponse.json(
        { success: false, error: 'donor_id and payment_method_id are required' },
        { status: 400 }
      );
    }

    // Get donor details
    const donor = await prisma.donor.findUnique({
      where: { id: donor_id },
      select: { id: true, email: true, name: true }
    });

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Find or create Stripe customer
    let customer;
    const existingCustomers = await stripe.customers.list({
      email: donor.email,
      limit: 1
    });

    if (existingCustomers.data.length > 0) {
      customer = existingCustomers.data[0];
    } else {
      customer = await stripe.customers.create({
        email: donor.email,
        name: donor.name,
        metadata: {
          donor_id: donor_id.toString(),
          organization_id: organization_id?.toString() || ''
        }
      });
    }

    // Attach payment method to customer
    await stripe.paymentMethods.attach(payment_method_id, {
      customer: customer.id,
    });

    // Set as default if requested
    if (set_as_default) {
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
      });
    }

    // Get the payment method details
    const paymentMethod = await stripe.paymentMethods.retrieve(payment_method_id);

    return NextResponse.json({
      success: true,
      payment_method: {
        id: paymentMethod.id,
        type: paymentMethod.type,
        card: {
          brand: paymentMethod.card.brand,
          last4: paymentMethod.card.last4,
          exp_month: paymentMethod.card.exp_month,
          exp_year: paymentMethod.card.exp_year
        },
        created: paymentMethod.created
      },
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name
      },
      message: 'Payment method added successfully'
    });

  } catch (error) {
    console.error('Error adding payment method:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add payment method' },
      { status: 500 }
    );
  }
}

// DELETE /api/subscriptions/payment-methods - Remove a payment method
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get('payment_method_id');

    if (!paymentMethodId) {
      return NextResponse.json(
        { success: false, error: 'payment_method_id is required' },
        { status: 400 }
      );
    }

    // Detach payment method from customer
    await stripe.paymentMethods.detach(paymentMethodId);

    return NextResponse.json({
      success: true,
      message: 'Payment method removed successfully'
    });

  } catch (error) {
    console.error('Error removing payment method:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to remove payment method' },
      { status: 500 }
    );
  }
}
