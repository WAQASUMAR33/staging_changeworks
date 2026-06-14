import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// POST /api/subscriptions/sync-stripe - Manually sync Stripe subscriptions to database
export async function POST(request) {
  try {
    const body = await request.json();
    const { donor_id, customer_email, customer_id } = body;

    // Validate required parameters
    if (!donor_id && !customer_email && !customer_id) {
      return NextResponse.json(
        { success: false, error: 'Either donor_id, customer_email, or customer_id is required' },
        { status: 400 }
      );
    }

    let customer = null;
    let donor = null;

    // Get donor information
    if (donor_id) {
      donor = await prisma.donor.findUnique({
        where: { id: parseInt(donor_id) },
        select: { id: true, name: true, email: true }
      });

      if (!donor) {
        return NextResponse.json(
          { success: false, error: 'Donor not found' },
          { status: 404 }
        );
      }
    }

    // Find Stripe customer
    if (customer_id) {
      // Direct customer ID provided
      customer = await stripe.customers.retrieve(customer_id);
    } else if (customer_email) {
      // Search by email
      const customers = await stripe.customers.list({
        email: customer_email,
        limit: 1
      });
      customer = customers.data[0];
    } else if (donor) {
      // Search by donor email
      const customers = await stripe.customers.list({
        email: donor.email,
        limit: 1
      });
      customer = customers.data[0];
    }

    if (!customer) {
      return NextResponse.json(
        { success: false, error: 'Stripe customer not found' },
        { status: 404 }
      );
    }

    // Get all subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 100
    });

    const syncedSubscriptions = [];
    const errors = [];

    // Sync each subscription
    for (const stripeSubscription of subscriptions.data) {
      try {
        // Extract metadata
        const donorId = parseInt(stripeSubscription.metadata.donor_id);
        const organizationId = parseInt(stripeSubscription.metadata.organization_id);
        const packageId = parseInt(stripeSubscription.metadata.package_id);

        // Get package details
        const packageData = await prisma.package.findUnique({
          where: { id: packageId }
        });

        if (!packageData) {
          errors.push(`Package ${packageId} not found for subscription ${stripeSubscription.id}`);
          continue;
        }

        // Create or update subscription record
        const subscriptionData = {
          stripe_subscription_id: stripeSubscription.id,
          donor_id: donorId,
          organization_id: organizationId,
          package_id: packageId,
          status: stripeSubscription.status.toUpperCase(),
          current_period_start: new Date(stripeSubscription.current_period_start * 1000),
          current_period_end: new Date(stripeSubscription.current_period_end * 1000),
          cancel_at_period_end: stripeSubscription.cancel_at_period_end,
          canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
          trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
          trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
          amount: packageData.price,
          currency: packageData.currency,
          interval: 'month', // Default to monthly
          interval_count: 1,
          metadata: JSON.stringify({
            stripe_customer_id: stripeSubscription.customer,
            created_via: 'manual_sync',
            synced_at: new Date()
          })
        };

        // Use upsert to create or update
        const dbSubscription = await prisma.subscription.upsert({
          where: {
            stripe_subscription_id: stripeSubscription.id
          },
          update: {
            status: stripeSubscription.status.toUpperCase(),
            current_period_start: new Date(stripeSubscription.current_period_start * 1000),
            current_period_end: new Date(stripeSubscription.current_period_end * 1000),
            cancel_at_period_end: stripeSubscription.cancel_at_period_end,
            canceled_at: stripeSubscription.canceled_at ? new Date(stripeSubscription.canceled_at * 1000) : null,
            trial_start: stripeSubscription.trial_start ? new Date(stripeSubscription.trial_start * 1000) : null,
            trial_end: stripeSubscription.trial_end ? new Date(stripeSubscription.trial_end * 1000) : null,
            updated_at: new Date()
          },
          create: subscriptionData,
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

        syncedSubscriptions.push(dbSubscription);
        console.log(`✅ Synced subscription ${stripeSubscription.id} for donor ${donorId}`);

      } catch (error) {
        console.error(`❌ Error syncing subscription ${stripeSubscription.id}:`, error);
        errors.push(`Failed to sync subscription ${stripeSubscription.id}: ${error.message}`);
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully synced ${syncedSubscriptions.length} subscriptions`,
      customer: {
        id: customer.id,
        email: customer.email,
        name: customer.name
      },
      synced_subscriptions: syncedSubscriptions,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    console.error('Error syncing Stripe subscriptions:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to sync subscriptions', details: error.message },
      { status: 500 }
    );
  }
}
