import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      donor_id,
      product_id,
      price_id,
      organization_id = 1 // Default organization if not provided
    } = body;

    // Validate required fields
    if (!donor_id || !product_id || !price_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: donor_id, product_id, price_id' },
        { status: 400 }
      );
    }

    // Get donor details
    const donor = await prisma.donor.findUnique({
      where: { id: donor_id },
      select: { id: true, name: true, email: true }
    });

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: organization_id },
      select: { id: true, name: true, email: true }
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Get Stripe product and price details
    const [stripeProduct, stripePrice] = await Promise.all([
      stripe.products.retrieve(product_id),
      stripe.prices.retrieve(price_id)
    ]);

    // Create or retrieve Stripe customer
    let customer;
    try {
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
            organization_id: organization_id.toString()
          }
        });
      }
    } catch (stripeError) {
      console.error('Stripe customer creation error:', stripeError);
      return NextResponse.json(
        { success: false, error: 'Failed to create Stripe customer' },
        { status: 500 }
      );
    }

    // Create Stripe checkout session for subscription
    try {
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: price_id,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/donor/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000'}/donor/dashboard/subscriptions?subscription=cancelled`,
        metadata: {
          donor_id: donor_id.toString(),
          organization_id: organization_id.toString(),
          product_id: product_id,
          price_id: price_id
        },
        subscription_data: {
          metadata: {
            donor_id: donor_id.toString(),
            organization_id: organization_id.toString(),
            product_id: product_id,
            price_id: price_id,
            package_id: '1' // Default package ID for Stripe products
          }
        }
      });

      return NextResponse.json({
        success: true,
        checkout_url: checkoutSession.url,
        session_id: checkoutSession.id,
        message: 'Checkout session created successfully'
      });

    } catch (stripeError) {
      console.error('Stripe checkout session creation error:', stripeError);
      return NextResponse.json(
        { success: false, error: 'Failed to create checkout session' },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Subscription creation error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
