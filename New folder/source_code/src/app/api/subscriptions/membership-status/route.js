import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma.jsx";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/membership-status - Get comprehensive membership status and payment records
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get('donor_id');
    const customerEmail = searchParams.get('customer_email');
    const includeInactive = searchParams.get('include_inactive') === 'true';

    // Validate required parameters
    if (!donorId && !customerEmail) {
      return NextResponse.json(
        { success: false, error: 'Either donor_id or customer_email is required' },
        { status: 400 }
      );
    }

    let donor = null;
    let customer = null;

    // Get donor information
    if (donorId) {
      donor = await prisma.donor.findUnique({
        where: { id: parseInt(donorId) },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          address: true,
          created_at: true,
          updated_at: true
        }
      });

      if (!donor) {
        return NextResponse.json(
          { success: false, error: 'Donor not found' },
          { status: 404 }
        );
      }
    }

    // Get customer information by email
    if (customerEmail) {
      const donors = await prisma.donor.findMany({
        where: { email: customerEmail },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          address: true,
          created_at: true,
          updated_at: true
        }
      });

      if (donors.length > 0) {
        donor = donors[0]; // Use first match
      }
    }

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Get all subscriptions for the donor
    const whereClause = {
      donor_id: donor.id
    };

    if (!includeInactive) {
      whereClause.status = {
        in: ['ACTIVE', 'TRIALING', 'PAST_DUE']
      };
    }

    const subscriptions = await prisma.subscription.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
            city: true,
            country: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            currency: true,
            features: true,
            duration: true,
            category: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Get payment records (transactions)
    const transactions = await prisma.transaction.findMany({
      where: {
        donor_id: donor.id
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Get subscription transactions
    const subscriptionTransactions = await prisma.subscription_transaction.findMany({
      where: {
        subscription: {
          donor_id: donor.id
        }
      },
      include: {
        subscription: {
          include: {
            package: {
              select: {
                name: true,
                price: true,
                currency: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Categorize subscriptions
    const activeSubscriptions = subscriptions.filter(sub => 
      ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status)
    );
    const canceledSubscriptions = subscriptions.filter(sub => 
      ['CANCELED', 'UNPAID'].includes(sub.status)
    );
    const scheduledForCancellation = subscriptions.filter(sub => 
      sub.cancel_at_period_end === true
    );

    // Get Stripe customer data if available
    let stripeCustomer = null;
    let stripeSubscriptions = [];
    let stripeInvoices = [];

    try {
      // Find Stripe customer by email
      const stripeCustomers = await stripe.customers.list({
        email: donor.email,
        limit: 1
      });

      if (stripeCustomers.data.length > 0) {
        stripeCustomer = stripeCustomers.data[0];

        // Get Stripe subscriptions
        const stripeSubs = await stripe.subscriptions.list({
          customer: stripeCustomer.id,
          status: 'all',
          limit: 100
        });
        stripeSubscriptions = stripeSubs.data;

        // Get recent invoices
        const invoices = await stripe.invoices.list({
          customer: stripeCustomer.id,
          limit: 20
        });
        stripeInvoices = invoices.data;
      }
    } catch (stripeError) {
      console.warn('Could not fetch Stripe data:', stripeError.message);
    }

    // Calculate membership statistics
    const membershipStats = {
      total_subscriptions: subscriptions.length,
      active_subscriptions: activeSubscriptions.length,
      canceled_subscriptions: canceledSubscriptions.length,
      scheduled_for_cancellation: scheduledForCancellation.length,
      total_transactions: transactions.length,
      total_subscription_transactions: subscriptionTransactions.length,
      membership_duration_days: donor.created_at ? 
        Math.floor((new Date() - new Date(donor.created_at)) / (1000 * 60 * 60 * 24)) : 0,
      total_amount_paid: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      total_subscription_amount: subscriptionTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    };

    // Determine overall membership status
    let overallStatus = 'INACTIVE';
    if (activeSubscriptions.length > 0) {
      if (scheduledForCancellation.length > 0) {
        overallStatus = 'SCHEDULED_FOR_CANCELLATION';
      } else if (activeSubscriptions.some(sub => sub.status === 'TRIALING')) {
        overallStatus = 'TRIALING';
      } else {
        overallStatus = 'ACTIVE';
      }
    } else if (canceledSubscriptions.length > 0) {
      overallStatus = 'CANCELED';
    }

    // Prepare response
    const response = {
      success: true,
      membership_status: {
        overall_status: overallStatus,
        donor: donor,
        statistics: membershipStats,
        last_updated: new Date().toISOString()
      },
      subscriptions: {
        total: subscriptions.length,
        active: activeSubscriptions,
        canceled: canceledSubscriptions,
        scheduled_for_cancellation: scheduledForCancellation,
        all: subscriptions
      },
      payments: {
        transactions: transactions,
        subscription_transactions: subscriptionTransactions,
        total_transactions: transactions.length + subscriptionTransactions.length
      },
      stripe_data: {
        customer: stripeCustomer,
        subscriptions: stripeSubscriptions,
        invoices: stripeInvoices
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching membership status:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch membership status', details: error.message },
      { status: 500 }
    );
  }
}

// POST /api/subscriptions/membership-status - Get membership status with filters
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      donor_id, 
      customer_email, 
      include_inactive = false,
      include_stripe_data = true,
      date_from,
      date_to
    } = body;

    // Validate required parameters
    if (!donor_id && !customer_email) {
      return NextResponse.json(
        { success: false, error: 'Either donor_id or customer_email is required' },
        { status: 400 }
      );
    }

    // Build date filter
    let dateFilter = {};
    if (date_from || date_to) {
      dateFilter.created_at = {};
      if (date_from) {
        dateFilter.created_at.gte = new Date(date_from);
      }
      if (date_to) {
        dateFilter.created_at.lte = new Date(date_to);
      }
    }

    // Get donor information
    let donor = null;
    if (donor_id) {
      donor = await prisma.donor.findUnique({
        where: { id: parseInt(donor_id) },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          address: true,
          created_at: true,
          updated_at: true
        }
      });
    } else if (customer_email) {
      const donors = await prisma.donor.findMany({
        where: { email: customer_email },
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          city: true,
          address: true,
          created_at: true,
          updated_at: true
        }
      });
      if (donors.length > 0) {
        donor = donors[0];
      }
    }

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Get subscriptions with filters
    const subscriptionWhere = {
      donor_id: donor.id,
      ...dateFilter
    };

    if (!include_inactive) {
      subscriptionWhere.status = {
        in: ['ACTIVE', 'TRIALING', 'PAST_DUE']
      };
    }

    const subscriptions = await prisma.subscription.findMany({
      where: subscriptionWhere,
      include: {
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

    // Get transactions with filters
    const transactionWhere = {
      donor_id: donor.id,
      ...dateFilter
    };

    const transactions = await prisma.transaction.findMany({
      where: transactionWhere,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Get subscription transactions with filters
    const subscriptionTransactionWhere = {
      subscription: {
        donor_id: donor.id
      },
      ...dateFilter
    };

    const subscriptionTransactions = await prisma.subscription_transaction.findMany({
      where: subscriptionTransactionWhere,
      include: {
        subscription: {
          include: {
            package: {
              select: {
                name: true,
                price: true,
                currency: true
              }
            }
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Calculate statistics
    const stats = {
      total_subscriptions: subscriptions.length,
      active_subscriptions: subscriptions.filter(sub => 
        ['ACTIVE', 'TRIALING', 'PAST_DUE'].includes(sub.status)
      ).length,
      total_transactions: transactions.length,
      total_subscription_transactions: subscriptionTransactions.length,
      total_amount_paid: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
      total_subscription_amount: subscriptionTransactions.reduce((sum, t) => sum + (t.amount || 0), 0)
    };

    const response = {
      success: true,
      donor: donor,
      statistics: stats,
      subscriptions: subscriptions,
      transactions: transactions,
      subscription_transactions: subscriptionTransactions,
      filters_applied: {
        include_inactive,
        include_stripe_data,
        date_from,
        date_to
      }
    };

    // Add Stripe data if requested
    if (include_stripe_data) {
      try {
        const stripeCustomers = await stripe.customers.list({
          email: donor.email,
          limit: 1
        });

        if (stripeCustomers.data.length > 0) {
          const stripeCustomer = stripeCustomers.data[0];
          const stripeSubs = await stripe.subscriptions.list({
            customer: stripeCustomer.id,
            status: 'all',
            limit: 100
          });
          const invoices = await stripe.invoices.list({
            customer: stripeCustomer.id,
            limit: 20
          });

          response.stripe_data = {
            customer: stripeCustomer,
            subscriptions: stripeSubs.data,
            invoices: invoices.data
          };
        }
      } catch (stripeError) {
        console.warn('Could not fetch Stripe data:', stripeError.message);
        response.stripe_data = null;
      }
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error fetching membership status with filters:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch membership status', details: error.message },
      { status: 500 }
    );
  }
}
