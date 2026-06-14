import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// GET /api/subscriptions/analytics - Get subscription analytics and metrics
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organization_id');
    const donorId = searchParams.get('donor_id');
    const period = searchParams.get('period') || '30'; // days
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Calculate date range
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(Date.now() - parseInt(period) * 24 * 60 * 60 * 1000);

    // Build where clause
    const where = {
      created_at: {
        gte: start,
        lte: end
      }
    };

    if (organizationId) {
      where.organization_id = parseInt(organizationId);
    }

    if (donorId) {
      where.donor_id = parseInt(donorId);
    }

    // Get subscription metrics
    const [
      totalSubscriptions,
      activeSubscriptions,
      canceledSubscriptions,
      subscriptionsByStatus,
      subscriptionsByPackage,
      revenueMetrics,
      subscriptionGrowth,
      churnMetrics
    ] = await Promise.all([
      // Total subscriptions
      prisma.subscription.count({ where }),
      
      // Active subscriptions
      prisma.subscription.count({ 
        where: { ...where, status: 'ACTIVE' } 
      }),
      
      // Canceled subscriptions
      prisma.subscription.count({ 
        where: { ...where, status: 'CANCELED' } 
      }),
      
      // Subscriptions by status
      prisma.subscription.groupBy({
        by: ['status'],
        where,
        _count: { status: true }
      }),
      
      // Subscriptions by package
      prisma.subscription.groupBy({
        by: ['package_id'],
        where,
        _count: { package_id: true },
        _sum: { amount: true }
      }),
      
      // Revenue metrics
      getRevenueMetrics(where),
      
      // Subscription growth
      getSubscriptionGrowth(where, start, end),
      
      // Churn metrics
      getChurnMetrics(where, start, end)
    ]);

    // Get package details for subscriptions by package
    const packageIds = subscriptionsByPackage.map(s => s.package_id);
    const packages = await prisma.package.findMany({
      where: { id: { in: packageIds } },
      select: { id: true, name: true, price: true, currency: true }
    });

    const subscriptionsByPackageWithDetails = subscriptionsByPackage.map(sub => {
      const packageData = packages.find(p => p.id === sub.package_id);
      return {
        package_id: sub.package_id,
        package_name: packageData?.name || 'Unknown',
        package_price: packageData?.price || 0,
        package_currency: packageData?.currency || 'USD',
        count: sub._count.package_id,
        total_revenue: sub._sum.amount || 0
      };
    });

    // Get recent transactions
    const recentTransactions = await prisma.subscriptionTransaction.findMany({
      where: {
        subscription: where
      },
      include: {
        subscription: {
          include: {
            donor: { select: { id: true, name: true, email: true } },
            organization: { select: { id: true, name: true } },
            package: { select: { id: true, name: true, price: true, currency: true } }
          }
        }
      },
      orderBy: { created_at: 'desc' },
      take: 10
    });

    // Get top donors by subscription value
    const topDonors = await prisma.subscription.groupBy({
      by: ['donor_id'],
      where,
      _sum: { amount: true },
      _count: { donor_id: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: 10
    });

    // Get donor details for top donors
    const donorIds = topDonors.map(d => d.donor_id);
    const donors = await prisma.donor.findMany({
      where: { id: { in: donorIds } },
      select: { id: true, name: true, email: true }
    });

    const topDonorsWithDetails = topDonors.map(donor => {
      const donorData = donors.find(d => d.id === donor.donor_id);
      return {
        donor_id: donor.donor_id,
        donor_name: donorData?.name || 'Unknown',
        donor_email: donorData?.email || 'Unknown',
        total_amount: donor._sum.amount || 0,
        subscription_count: donor._count.donor_id
      };
    });

    return NextResponse.json({
      success: true,
      analytics: {
        period: {
          start: start,
          end: end,
          days: Math.ceil((end - start) / (1000 * 60 * 60 * 24))
        },
        overview: {
          total_subscriptions: totalSubscriptions,
          active_subscriptions: activeSubscriptions,
          canceled_subscriptions: canceledSubscriptions,
          active_rate: totalSubscriptions > 0 ? (activeSubscriptions / totalSubscriptions * 100).toFixed(2) : 0
        },
        subscriptions_by_status: subscriptionsByStatus.map(s => ({
          status: s.status,
          count: s._count.status
        })),
        subscriptions_by_package: subscriptionsByPackageWithDetails,
        revenue: revenueMetrics,
        growth: subscriptionGrowth,
        churn: churnMetrics,
        top_donors: topDonorsWithDetails,
        recent_transactions: recentTransactions.map(t => ({
          id: t.id,
          amount: t.amount,
          currency: t.currency,
          status: t.status,
          created_at: t.created_at,
          subscription: {
            id: t.subscription.id,
            donor: t.subscription.donor,
            organization: t.subscription.organization,
            package: t.subscription.package
          }
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching subscription analytics:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch subscription analytics' },
      { status: 500 }
    );
  }
}

// Helper function to get revenue metrics
async function getRevenueMetrics(where) {
  try {
    const [
      totalRevenue,
      successfulPayments,
      failedPayments,
      pendingPayments
    ] = await Promise.all([
      // Total revenue from successful transactions
      prisma.subscriptionTransaction.aggregate({
        where: {
          subscription: where,
          status: 'SUCCEEDED'
        },
        _sum: { amount: true }
      }),
      
      // Successful payments count
      prisma.subscriptionTransaction.count({
        where: {
          subscription: where,
          status: 'SUCCEEDED'
        }
      }),
      
      // Failed payments count
      prisma.subscriptionTransaction.count({
        where: {
          subscription: where,
          status: 'FAILED'
        }
      }),
      
      // Pending payments count
      prisma.subscriptionTransaction.count({
        where: {
          subscription: where,
          status: 'PENDING'
        }
      })
    ]);

    return {
      total_revenue: totalRevenue._sum.amount || 0,
      successful_payments: successfulPayments,
      failed_payments: failedPayments,
      pending_payments: pendingPayments,
      success_rate: (successfulPayments + failedPayments) > 0 ? 
        (successfulPayments / (successfulPayments + failedPayments) * 100).toFixed(2) : 0
    };
  } catch (error) {
    console.error('Error calculating revenue metrics:', error);
    return {
      total_revenue: 0,
      successful_payments: 0,
      failed_payments: 0,
      pending_payments: 0,
      success_rate: 0
    };
  }
}

// Helper function to get subscription growth
async function getSubscriptionGrowth(where, start, end) {
  try {
    // Get subscriptions created in the period
    const newSubscriptions = await prisma.subscription.count({
      where: {
        ...where,
        created_at: {
          gte: start,
          lte: end
        }
      }
    });

    // Get subscriptions created in the previous period
    const periodLength = end - start;
    const previousStart = new Date(start.getTime() - periodLength);
    const previousEnd = start;

    const previousSubscriptions = await prisma.subscription.count({
      where: {
        ...where,
        created_at: {
          gte: previousStart,
          lte: previousEnd
        }
      }
    });

    const growthRate = previousSubscriptions > 0 ? 
      ((newSubscriptions - previousSubscriptions) / previousSubscriptions * 100).toFixed(2) : 0;

    return {
      new_subscriptions: newSubscriptions,
      previous_period_subscriptions: previousSubscriptions,
      growth_rate: growthRate
    };
  } catch (error) {
    console.error('Error calculating subscription growth:', error);
    return {
      new_subscriptions: 0,
      previous_period_subscriptions: 0,
      growth_rate: 0
    };
  }
}

// Helper function to get churn metrics
async function getChurnMetrics(where, start, end) {
  try {
    // Get canceled subscriptions in the period
    const canceledSubscriptions = await prisma.subscription.count({
      where: {
        ...where,
        status: 'CANCELED',
        canceled_at: {
          gte: start,
          lte: end
        }
      }
    });

    // Get total active subscriptions at the start of the period
    const activeAtStart = await prisma.subscription.count({
      where: {
        ...where,
        status: 'ACTIVE',
        created_at: {
          lte: start
        }
      }
    });

    const churnRate = activeAtStart > 0 ? 
      (canceledSubscriptions / activeAtStart * 100).toFixed(2) : 0;

    return {
      canceled_subscriptions: canceledSubscriptions,
      active_at_start: activeAtStart,
      churn_rate: churnRate
    };
  } catch (error) {
    console.error('Error calculating churn metrics:', error);
    return {
      canceled_subscriptions: 0,
      active_at_start: 0,
      churn_rate: 0
    };
  }
}
