import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/subscriptions/create-complete - Create customer, subscription, and complete payment in one step
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      donor_id,
      organization_id,
      package_id,
      customer_email,
      customer_name,
      payment_method_id,
      trial_period_days = 0
    } = body;

    // Validate required fields
    if (!donor_id || !organization_id || !package_id || !payment_method_id) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: donor_id, organization_id, package_id, payment_method_id' },
        { status: 400 }
      );
    }

    // Get package details
    const packageData = await prisma.package.findUnique({
      where: { id: package_id }
    });

    if (!packageData) {
      return NextResponse.json(
        { success: false, error: 'Package not found' },
        { status: 404 }
      );
    }

    // Get donor and organization details
    const [donor, organization] = await Promise.all([
      prisma.donor.findUnique({
        where: { id: donor_id },
        select: { id: true, name: true, email: true }
      }),
      prisma.organization.findUnique({
        where: { id: organization_id },
        select: { id: true, name: true, email: true }
      })
    ]);

    if (!donor || !organization) {
      return NextResponse.json(
        { success: false, error: 'Donor or organization not found' },
        { status: 404 }
      );
    }

    // Step 1: Create or retrieve Stripe customer
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
        { 
          success: false, 
          error: 'Failed to create Stripe customer',
          details: {
            type: stripeError.type,
            code: stripeError.code,
            message: stripeError.message
          }
        },
        { status: 500 }
      );
    }

    // Step 2: Attach payment method to customer
    try {
      await stripe.paymentMethods.attach(payment_method_id, {
        customer: customer.id,
      });

      // Set as default payment method
      await stripe.customers.update(customer.id, {
        invoice_settings: {
          default_payment_method: payment_method_id,
        },
      });
    } catch (stripeError) {
      console.error('Payment method attachment error:', stripeError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to attach payment method',
          details: {
            type: stripeError.type,
            code: stripeError.code,
            message: stripeError.message
          }
        },
        { status: 500 }
      );
    }

    // Step 3: Create subscription with immediate payment
    let stripeSubscription;
    try {
      const subscriptionData = {
        customer: customer.id,
        items: [{
          price_data: {
            currency: packageData.currency.toLowerCase(),
            product_data: {
              name: packageData.name,
              description: packageData.description,
            },
            unit_amount: Math.round(packageData.price * 100), // Convert to cents
            recurring: {
              interval: 'month', // Default to monthly
            },
          },
        }],
        collection_method: 'charge_automatically',
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          donor_id: donor_id.toString(),
          organization_id: organization_id.toString(),
          package_id: package_id.toString()
        }
      };

      // Add trial period if specified
      if (trial_period_days > 0) {
        subscriptionData.trial_period_days = trial_period_days;
      }

      stripeSubscription = await stripe.subscriptions.create(subscriptionData);
    } catch (stripeError) {
      console.error('Stripe subscription creation error:', stripeError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create Stripe subscription',
          details: {
            type: stripeError.type,
            code: stripeError.code,
            message: stripeError.message
          }
        },
        { status: 500 }
      );
    }

    // Step 4: Confirm the payment intent to complete payment
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.confirm(
        stripeSubscription.latest_invoice.payment_intent.id,
        {
          payment_method: payment_method_id,
          return_url: `https://app.changeworksfund.org/subscription/success?session_id=${stripeSubscription.id}`
        }
      );
    } catch (stripeError) {
      console.error('Payment confirmation error:', stripeError);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to confirm payment',
          details: {
            type: stripeError.type,
            code: stripeError.code,
            message: stripeError.message
          }
        },
        { status: 500 }
      );
    }

    // Step 5: Save subscription to database
    const subscription = await prisma.subscription.create({
      data: {
        stripe_subscription_id: stripeSubscription.id,
        donor_id,
        organization_id,
        package_id,
        status: stripeSubscription.status.toUpperCase(),
        current_period_start: new Date(stripeSubscription.current_period_start * 1000),
        current_period_end: new Date(stripeSubscription.current_period_end * 1000),
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
        trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
        trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
        amount: packageData.price,
        currency: packageData.currency,
        interval: 'month',
        interval_count: 1,
        metadata: JSON.stringify({
          stripe_customer_id: customer.id,
          payment_method_id: payment_method_id,
          created_via: 'api_complete'
        })
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

    // Return complete subscription details
    return NextResponse.json({
      success: true,
      subscription,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name
      },
      package: {
        id: packageData.id,
        name: packageData.name,
        price: packageData.price,
        currency: packageData.currency
      },
      payment: {
        status: paymentIntent.status,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency
      },
      stripe_subscription_id: stripeSubscription.id,
      message: 'Subscription created and payment completed successfully'
    });

  } catch (error) {
    console.error('Error creating complete subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create complete subscription' },
      { status: 500 }
    );
  }
}
