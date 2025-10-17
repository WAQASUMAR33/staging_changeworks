import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions - List all subscriptions
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get('donor_id');
    const organizationId = searchParams.get('organization_id');
    const status = searchParams.get('status');
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;

    // Build where clause
    const where = {};
    if (donorId) where.donor_id = parseInt(donorId);
    if (organizationId) where.organization_id = parseInt(organizationId);
    if (status) where.status = status;

    // Get subscriptions with related data
    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true
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
        },
        subscription_transactions: {
          orderBy: {
            created_at: 'desc'
          },
          take: 5 // Get last 5 transactions
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.subscription.count({ where });

    return NextResponse.json({
      success: true,
      subscriptions,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscriptions' },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions - Create a new subscription
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      donor_id,
      organization_id,
      package_id,
      payment_method_id,
      customer_email,
      customer_name,
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

    // Attach payment method to customer
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
        { success: false, error: 'Failed to attach payment method' },
        { status: 500 }
      );
    }

    // Create Stripe subscription
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
              interval: 'month', // Default to monthly, can be made configurable
            },
          },
        }],
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
        { success: false, error: 'Failed to create Stripe subscription' },
        { status: 500 }
      );
    }

    // Save subscription to database
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
        interval: 'month', // Default interval
        interval_count: 1,
        metadata: JSON.stringify({
          stripe_customer_id: customer.id,
          payment_method_id: payment_method_id,
          created_via: 'api'
        })
      },
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            imageUrl: true
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

    // Return subscription with client secret for payment confirmation
    return NextResponse.json({
      success: true,
      subscription,
      client_secret: stripeSubscription.latest_invoice.payment_intent.client_secret,
      stripe_subscription_id: stripeSubscription.id,
      message: 'Subscription created successfully. Complete payment to activate.'
    });

  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create subscription' },
      { status: 500 }
    );
  }
}