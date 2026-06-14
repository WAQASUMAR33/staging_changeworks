import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/check-customer - Check if customer has active subscription
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get('donor_id');
    const customerEmail = searchParams.get('customer_email');
    const organizationId = searchParams.get('organization_id');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Validate required parameters - prioritize donor_id
    if (!donorId && !customerEmail) {
      return NextResponse.json({
        success: false,
        error: 'Either donor_id or customer_email is required'
      }, { status: 400 });
    }

    // If donor_id is provided, validate that the donor exists
    let donor = null;
    if (donorId) {
      try {
        donor = await prisma.donor.findUnique({
          where: { id: parseInt(donorId) },
          select: {
            id: true,
            name: true,
            email: true
          }
        });

        if (!donor) {
          return NextResponse.json({
            success: false,
            error: `Donor with ID ${donorId} not found`
          }, { status: 404 });
        }
      } catch (error) {
        console.error('Error validating donor:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to validate donor'
        }, { status: 500 });
      }
    }

    // Build where clause - prioritize donor_id
    const where = {};
    
    if (donorId) {
      where.donor_id = parseInt(donorId);
    } else if (customerEmail) {
      // If no donor_id but customer_email provided, find donor by email first
      try {
        const donorByEmail = await prisma.donor.findFirst({
          where: { 
            email: customerEmail
          },
          select: {
            id: true,
            name: true,
            email: true
          }
        });

        if (donorByEmail) {
          where.donor_id = donorByEmail.id;
          donor = donorByEmail;
        } else {
          // No donor found with this email, return empty result
          return NextResponse.json({
            success: true,
            customer: {
              donor_id: null,
              customer_email: customerEmail,
              organization_id: organizationId ? parseInt(organizationId) : null
            },
            subscription_status: {
              has_subscription: false,
              has_active_subscription: false,
              total_subscriptions: 0,
              active_subscriptions: 0,
              inactive_subscriptions: 0,
              latest_subscription: null,
              active_subscription: null
            },
            revenue: {
              monthly_revenue: 0,
              currency: 'USD'
            },
            next_billing_date: null,
            subscriptions: [],
            stripe_subscriptions: [],
            message: 'No donor found with this email address'
          });
        }
      } catch (error) {
        console.error('Error finding donor by email:', error);
        return NextResponse.json({
          success: false,
          error: 'Failed to find donor by email'
        }, { status: 500 });
      }
    }
    
    if (organizationId) {
      where.organization_id = parseInt(organizationId);
    }

    // If not including inactive, only get active subscriptions
    if (!includeInactive) {
      where.status = 'ACTIVE';
    }

    // Get subscriptions from database
    const subscriptions = await prisma.subscription.findMany({
      where,
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
        },
        subscription_transactions: {
          orderBy: {
            created_at: 'desc'
          },
          take: 1 // Get latest transaction
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Since we've already validated the donor, we can use subscriptions directly
    let filteredSubscriptions = subscriptions;

    // Check Stripe for additional subscription data
    let stripeSubscriptions = [];
    if (filteredSubscriptions.length > 0) {
      try {
        // Get Stripe customer by email - use the validated donor's email
        const customerEmail = donor ? donor.email : filteredSubscriptions[0].donor.email;
        const customers = await stripe.customers.list({
          email: customerEmail,
          limit: 1
        });

        if (customers.data.length > 0) {
          const customer = customers.data[0];
          
          // Get all subscriptions for this customer
          const stripeSubs = await stripe.subscriptions.list({
            customer: customer.id,
            status: 'all',
            limit: 100
          });

          stripeSubscriptions = stripeSubs.data.map(sub => ({
            id: sub.id,
            status: sub.status,
            current_period_start: new Date(sub.current_period_start * 1000),
            current_period_end: new Date(sub.current_period_end * 1000),
            cancel_at_period_end: sub.cancel_at_period_end,
            canceled_at: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
            trial_start: sub.trial_start ? new Date(sub.trial_start * 1000) : null,
            trial_end: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
            items: sub.items.data.map(item => ({
              id: item.id,
              price: {
                id: item.price.id,
                unit_amount: item.price.unit_amount,
                currency: item.price.currency,
                recurring: item.price.recurring,
                product: item.price.product
              },
              quantity: item.quantity
            })),
            metadata: sub.metadata
          }));
        }
      } catch (stripeError) {
        console.error('Error fetching Stripe subscriptions:', stripeError);
        // Continue without Stripe data
      }
    }

    // Determine subscription status
    const hasActiveSubscription = filteredSubscriptions.some(sub => sub.status === 'ACTIVE');
    const hasAnySubscription = filteredSubscriptions.length > 0;
    const activeSubscriptions = filteredSubscriptions.filter(sub => sub.status === 'ACTIVE');
    const inactiveSubscriptions = filteredSubscriptions.filter(sub => sub.status !== 'ACTIVE');

    // Get subscription summary
    const subscriptionSummary = {
      has_subscription: hasAnySubscription,
      has_active_subscription: hasActiveSubscription,
      total_subscriptions: filteredSubscriptions.length,
      active_subscriptions: activeSubscriptions.length,
      inactive_subscriptions: inactiveSubscriptions.length,
      latest_subscription: filteredSubscriptions[0] || null,
      active_subscription: activeSubscriptions[0] || null
    };

    // Calculate total monthly revenue from active subscriptions
    const monthlyRevenue = activeSubscriptions.reduce((total, sub) => {
      return total + (sub.amount || 0);
    }, 0);

    // Get next billing date
    let nextBillingDate = null;
    if (activeSubscriptions.length > 0) {
      const latestActive = activeSubscriptions[0];
      nextBillingDate = latestActive.current_period_end;
    }

    return NextResponse.json({
      success: true,
      customer: {
        donor_id: donor ? donor.id : null,
        customer_email: donor ? donor.email : customerEmail,
        organization_id: organizationId ? parseInt(organizationId) : null
      },
      subscription_status: subscriptionSummary,
      revenue: {
        monthly_revenue: monthlyRevenue,
        currency: activeSubscriptions[0]?.currency || 'USD'
      },
      next_billing_date: nextBillingDate,
      subscriptions: filteredSubscriptions.map(sub => ({
        id: sub.id,
        stripe_subscription_id: sub.stripe_subscription_id,
        status: sub.status,
        amount: sub.amount,
        currency: sub.currency,
        interval: sub.interval,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        cancel_at_period_end: sub.cancel_at_period_end,
        canceled_at: sub.canceled_at,
        trial_start: sub.trial_start,
        trial_end: sub.trial_end,
        created_at: sub.created_at,
        updated_at: sub.updated_at,
        donor: sub.donor,
        organization: sub.organization,
        package: sub.package,
        latest_transaction: sub.subscription_transactions[0] || null
      })),
      stripe_subscriptions: stripeSubscriptions,
      message: hasActiveSubscription 
        ? `Customer has ${activeSubscriptions.length} active subscription(s)`
        : hasAnySubscription 
          ? `Customer has ${inactiveSubscriptions.length} inactive subscription(s)`
          : 'Customer has no subscriptions'
    });

  } catch (error) {
    console.error('Error checking customer subscription:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check customer subscription',
      details: error.message
    }, { status: 500 });
  }
}

// POST /api/subscriptions/check-customer - Check multiple customers at once
export async function POST(request) {
  try {
    const body = await request.json();
    const { customers, organization_id, include_inactive = false } = body;

    // Validate required parameters
    if (!customers || !Array.isArray(customers) || customers.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'customers array is required and must not be empty'
      }, { status: 400 });
    }

    // Check each customer
    const results = await Promise.all(
      customers.map(async (customer) => {
        try {
          const { donor_id, customer_email } = customer;
          
          if (!donor_id && !customer_email) {
            return {
              customer,
              success: false,
              error: 'Either donor_id or customer_email is required'
            };
          }

          // Validate donor if donor_id is provided
          let donor = null;
          if (donor_id) {
            try {
              donor = await prisma.donor.findUnique({
                where: { id: parseInt(donor_id) },
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              });

              if (!donor) {
                return {
                  customer,
                  success: false,
                  error: `Donor with ID ${donor_id} not found`
                };
              }
            } catch (error) {
              return {
                customer,
                success: false,
                error: 'Failed to validate donor'
              };
            }
          }

          // Build where clause - prioritize donor_id
          const where = {};
          
          if (donor_id) {
            where.donor_id = parseInt(donor_id);
          } else if (customer_email) {
            // If no donor_id but customer_email provided, find donor by email first
            try {
              const donorByEmail = await prisma.donor.findFirst({
                where: { 
                  email: customer_email
                },
                select: {
                  id: true,
                  name: true,
                  email: true
                }
              });

              if (donorByEmail) {
                where.donor_id = donorByEmail.id;
                donor = donorByEmail;
              } else {
                // No donor found with this email, return empty result
                return {
                  customer,
                  success: true,
                  subscription_status: {
                    has_subscription: false,
                    has_active_subscription: false,
                    total_subscriptions: 0,
                    active_subscriptions: 0
                  },
                  subscriptions: [],
                  message: 'No donor found with this email address'
                };
              }
            } catch (error) {
              return {
                customer,
                success: false,
                error: 'Failed to find donor by email'
              };
            }
          }
          
          if (organization_id) {
            where.organization_id = parseInt(organization_id);
          }

          // If not including inactive, only get active subscriptions
          if (!include_inactive) {
            where.status = 'ACTIVE';
          }

          // Get subscriptions from database
          const subscriptions = await prisma.subscription.findMany({
            where,
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

          // Since we've already validated the donor, we can use subscriptions directly
          let filteredSubscriptions = subscriptions;

          // Determine subscription status
          const hasActiveSubscription = filteredSubscriptions.some(sub => sub.status === 'ACTIVE');
          const hasAnySubscription = filteredSubscriptions.length > 0;
          const activeSubscriptions = filteredSubscriptions.filter(sub => sub.status === 'ACTIVE');

          return {
            customer,
            success: true,
            subscription_status: {
              has_subscription: hasAnySubscription,
              has_active_subscription: hasActiveSubscription,
              total_subscriptions: filteredSubscriptions.length,
              active_subscriptions: activeSubscriptions.length
            },
            subscriptions: filteredSubscriptions.map(sub => ({
              id: sub.id,
              status: sub.status,
              amount: sub.amount,
              currency: sub.currency,
              current_period_end: sub.current_period_end,
              package: sub.package
            }))
          };
        } catch (error) {
          return {
            customer,
            success: false,
            error: error.message
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      results,
      summary: {
        total_customers: customers.length,
        customers_with_subscriptions: results.filter(r => r.success && r.subscription_status?.has_subscription).length,
        customers_with_active_subscriptions: results.filter(r => r.success && r.subscription_status?.has_active_subscription).length
      }
    });

  } catch (error) {
    console.error('Error checking multiple customer subscriptions:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to check customer subscriptions',
      details: error.message
    }, { status: 500 });
  }
}
