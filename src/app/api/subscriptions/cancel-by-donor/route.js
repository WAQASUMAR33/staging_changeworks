import { NextResponse } from "next/server";
import { createStripeClient } from '@/app/lib/payment-mode';
import { prisma } from "../../../lib/prisma";
import { corsHeaders } from '@/app/lib/cors';


// POST /api/subscriptions/cancel-by-donor - Cancel subscription by donor ID
export async function POST(request) {
  try {
    const stripe = await createStripeClient();
    const body = await request.json();
    const { donor_id, subscription_id, cancel_immediately = false } = body;

    // Validate required fields
    if (!donor_id) {
      return NextResponse.json(
        { success: false, error: 'donor_id is required' },
        { status: 400 }
      );
    }

    // Build query
    const whereClause = {
      donor_id: parseInt(donor_id),
      status: {
        in: ['ACTIVE', 'TRIALING', 'PAST_DUE']
      }
    };

    // If subscription_id is provided, only cancel that specific subscription
    if (subscription_id) {
      whereClause.id = parseInt(subscription_id);
    }

    // Find donor's active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: whereClause,
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
            email: true,
            stripeAccountId: true
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

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'No active subscriptions found for this donor',
          donor_id: parseInt(donor_id)
        },
        { status: 404 }
      );
    }

    const results = [];
    const errors = [];

    // Cancel each subscription
    for (const subscription of subscriptions) {
      console.log(`Processing cancellation for subscription ${subscription.id} (Stripe ID: ${subscription.stripe_subscription_id})`);
      console.log(`Cancel immediately requested: ${cancel_immediately} (${typeof cancel_immediately})`);

      // Determine Stripe context (Platform or Connected Account)
      const stripeOptions = {};
      if (subscription.organization?.stripeAccountId) {
        stripeOptions.stripeAccount = subscription.organization.stripeAccountId;
        console.log(`Using Connected Account: ${subscription.organization.stripeAccountId}`);
      } else {
        console.log('Using Platform Account');
      }

      try {
        let stripeResponse;
        let effectiveImmediateCancel = cancel_immediately;

        try {
          if (cancel_immediately) {
            // Cancel immediately
            const canceledSub = await stripe.subscriptions.cancel(subscription.stripe_subscription_id, stripeOptions);
            console.log(`Stripe cancellation successful. Stripe status: ${canceledSub.status}`);
            stripeResponse = { message: 'Subscription canceled immediately' };
          } else {
            // Cancel at period end
            const updatedSub = await stripe.subscriptions.update(subscription.stripe_subscription_id, {
              cancel_at_period_end: true,
            }, stripeOptions);
            console.log(`Stripe update successful. Stripe status: ${updatedSub.status}, cancel_at_period_end: ${updatedSub.cancel_at_period_end}`);
            stripeResponse = { message: 'Subscription will be canceled at the end of the current period' };
          }
        } catch (stripeError) {
          // Check if subscription is missing in Stripe
          if (stripeError.code === 'resource_missing') {
            console.warn(`Subscription ${subscription.stripe_subscription_id} missing in Stripe (Account: ${stripeOptions.stripeAccount || 'Platform'}). Attempting to find correct active subscription...`);
            
            let recoverySuccess = false;

            // Try to find the correct subscription by donor email and package price
            try {
              const donorEmail = subscription.donor?.email;
              if (donorEmail) {
                 const customers = await stripe.customers.list({ email: donorEmail, limit: 1 }, stripeOptions);
                 
                 if (customers.data.length > 0) {
                   const customer = customers.data[0];
                   console.log(`Found Stripe customer ${customer.id} for email ${donorEmail}`);
                   
                   const activeSubs = await stripe.subscriptions.list({ 
                     customer: customer.id, 
                     status: 'active' 
                   }, stripeOptions);
                   
                   console.log(`Found ${activeSubs.data.length} active subscriptions for customer`);

                   // Find matching subscription (prefer amount from subscription record, fallback to package)
                   // subscription.amount should be accurate as it is saved during creation
                   const targetAmount = subscription.amount 
                     ? Math.round(subscription.amount * 100) 
                     : Math.round(subscription.package.price * 100);
                   
                   const targetCurrency = subscription.package.currency.toLowerCase();
                   
                   console.log(`Looking for subscription with amount ${targetAmount} and currency ${targetCurrency}`);

                   const matchingSub = activeSubs.data.find(sub => {
                     const item = sub.items.data[0];
                     return item && 
                            item.price.unit_amount === targetAmount && 
                            item.price.currency.toLowerCase() === targetCurrency;
                   });
                   
                   if (matchingSub) {
                      console.log(`Found matching active subscription: ${matchingSub.id}. Updating local record and cancelling.`);
                      
                      // Update local record with correct Stripe ID
                      await prisma.$executeRaw`
                        UPDATE subscriptions 
                        SET stripe_subscription_id = ${matchingSub.id}
                        WHERE id = ${subscription.id}
                      `;
                      
                      // Now cancel the correct one
                      if (cancel_immediately) {
                        const canceledSub = await stripe.subscriptions.cancel(matchingSub.id, stripeOptions);
                        console.log(`Recovered cancellation successful. Stripe status: ${canceledSub.status}`);
                        stripeResponse = { message: 'Found correct subscription and canceled immediately' };
                      } else {
                        const updatedSub = await stripe.subscriptions.update(matchingSub.id, { cancel_at_period_end: true }, stripeOptions);
                        console.log(`Recovered update successful. Stripe status: ${updatedSub.status}`);
                        stripeResponse = { message: 'Found correct subscription and scheduled cancellation' };
                      }
                      
                      // Update the variable so the final log shows the correct ID
                      subscription.stripe_subscription_id = matchingSub.id;
                      recoverySuccess = true;
                      
                   } else {
                      console.warn('No matching active subscription found in Stripe with same price/currency.');
                   }
                 } else {
                   console.warn('Donor customer not found in Stripe.');
                 }
              } else {
                 console.warn('Donor email missing.');
              }
            } catch (recoveryError) {
              console.error('Error during recovery attempt:', recoveryError);
            }

            if (!recoverySuccess) {
               console.warn('Recovery failed. Marking as canceled locally.');
               stripeResponse = { message: 'Subscription missing in Stripe, marked as canceled locally' };
               effectiveImmediateCancel = true;
            }
          } else {
            throw stripeError; // Re-throw other errors
          }
        }

        // Update database using raw SQL to avoid Prisma enum issues
        console.log(`Updating subscription ${subscription.id} in database...`);
        console.log(`Stripe subscription ID: ${subscription.stripe_subscription_id}`);
        console.log(`Cancel immediately: ${effectiveImmediateCancel}`);
        
        const newStatus = effectiveImmediateCancel ? 'CANCELED' : 'CANCELED_AT_PERIOD_END';
        const cancelAtPeriodEnd = !effectiveImmediateCancel ? 1 : 0;
        const canceledAt = effectiveImmediateCancel ? new Date().toISOString().slice(0, 19).replace('T', ' ') : null;
        
        // Use raw SQL to update the subscription
        await prisma.$executeRaw`
          UPDATE subscriptions 
          SET 
            cancel_at_period_end = ${cancelAtPeriodEnd},
            canceled_at = ${canceledAt},
            status = ${newStatus},
            updated_at = NOW()
          WHERE id = ${subscription.id}
        `;
        
        // Fetch the updated subscription
        const updatedSubscription = await prisma.subscription.findUnique({
          where: { id: subscription.id },
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

        console.log(`Successfully updated subscription ${subscription.id} in database`);
        console.log(`New status: ${updatedSubscription.status}`);
        console.log(`Cancel at period end: ${updatedSubscription.cancel_at_period_end}`);
        
        results.push({
          subscription_id: subscription.id,
          stripe_subscription_id: subscription.stripe_subscription_id,
          status: 'success',
          subscription: updatedSubscription,
          stripe_response: stripeResponse
        });

      } catch (error) {
        console.error(`Error processing Donation ${subscription.id}:`, error);
        
        // Check if it's a Stripe error or database error
        if (error.type && error.type.startsWith('Stripe')) {
          console.error(`Stripe cancellation error for subscription ${subscription.id}:`, error);
          errors.push({
            subscription_id: subscription.id,
            stripe_subscription_id: subscription.stripe_subscription_id,
            status: 'stripe_error',
            error: error.message
          });
        } else {
          console.error(`Database update error for subscription ${subscription.id}:`, error);
          errors.push({
            subscription_id: subscription.id,
            stripe_subscription_id: subscription.stripe_subscription_id,
            status: 'database_error',
            error: error.message
          });
        }
      }
    }

    // Prepare response
    const response = {
      success: true,
      donor_id: parseInt(donor_id),
      total_subscriptions: subscriptions.length,
      successful_cancellations: results.length,
      failed_cancellations: errors.length,
      cancel_immediately: cancel_immediately,
      results: results,
      errors: errors.length > 0 ? errors : undefined
    };

    if (errors.length > 0) {
      response.message = `${results.length} subscription(s) canceled successfully, ${errors.length} failed`;
    } else {
      response.message = cancel_immediately 
        ? `${results.length} subscription(s) canceled immediately`
        : `${results.length} subscription(s) scheduled for cancellation at period end`;
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error canceling subscription by donor ID:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to cancel subscription', details: error.message },
      { status: 500 }
    );
  }
}

// GET /api/subscriptions/cancel-by-donor - Get cancellation status by donor ID
export async function GET(request) {
  try {
    const stripe = await createStripeClient();
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get('donor_id');

    if (!donorId) {
      return NextResponse.json(
        { success: false, error: 'donor_id parameter is required' },
        { status: 400 }
      );
    }

    // Find all subscriptions for the donor
    const subscriptions = await prisma.subscription.findMany({
      where: {
        donor_id: parseInt(donorId)
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
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { 
          success: true,
          donor_id: parseInt(donorId),
          message: 'No subscriptions found for this donor',
          subscriptions: []
        }
      );
    }

    // Categorize subscriptions
    const activeSubscriptions = subscriptions.filter(sub => 
      ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status)
    );
    const canceledSubscriptions = subscriptions.filter(sub => 
      ['CANCELED', 'UNPAID'].includes(sub.status)
    );
    const scheduledForCancellation = subscriptions.filter(sub => 
      sub.cancel_at_period_end === true || sub.status === 'CANCELED_AT_PERIOD_END'
    );

    return NextResponse.json({
      success: true,
      donor_id: parseInt(donorId),
      total_subscriptions: subscriptions.length,
      active_subscriptions: activeSubscriptions.length,
      canceled_subscriptions: canceledSubscriptions.length,
      scheduled_for_cancellation: scheduledForCancellation.length,
      subscriptions: subscriptions,
      summary: {
        active: activeSubscriptions,
        canceled: canceledSubscriptions,
        scheduled_for_cancellation: scheduledForCancellation
      }
    });

  } catch (error) {
    console.error('Error fetching subscription status by donor ID:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription status', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
