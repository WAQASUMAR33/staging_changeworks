import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request) {
  try {
    // Get organization ID from query params or headers
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    
    if (!organizationId) {
      return NextResponse.json({
        success: false,
        error: 'Organization ID is required'
      }, { status: 400 });
    }

    const orgId = parseInt(organizationId);
    
    // Get current date for filtering
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get organization data
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, email: true, imageUrl: true }
    });

    if (!organization) {
      return NextResponse.json({
        success: false,
        error: 'Organization not found'
      }, { status: 404 });
    }

    // Get organization-specific statistics
    const [
      totalDonors,
      totalDonations,
      ghlAccountsCount,
      thisMonthDonations,
      lastMonthDonations,
      lastMonthDonors,
      thisMonthDonors,
      lastMonthGhlAccounts,
      thisMonthGhlAccounts
    ] = await Promise.all([
      // Total donors for this organization
      prisma.donor.count({
        where: {
          organization_id: orgId,
          status: true
        }
      }),
      
      // Total donations amount for this organization
      prisma.saveTrRecord.aggregate({
        where: {
          trx_organization_id: orgId,
          pay_status: 'completed'
        },
        _sum: { trx_amount: true }
      }),
      
      // Total GHL accounts for this organization
      prisma.gHLAccount.count({
        where: {
          organization_id: orgId,
          status: 'active'
        }
      }),
      
      // This month donations
      prisma.saveTrRecord.aggregate({
        where: {
          trx_organization_id: orgId,
          pay_status: 'completed',
          trx_date: {
            gte: startOfMonth
          }
        },
        _sum: { trx_amount: true }
      }),
      
      // Last month donations for comparison
      prisma.saveTrRecord.aggregate({
        where: {
          trx_organization_id: orgId,
          pay_status: 'completed',
          trx_date: {
            gte: startOfLastMonth,
            lt: endOfLastMonth
          }
        },
        _sum: { trx_amount: true }
      }),
      
      // Donor growth comparison
      prisma.donor.count({
        where: {
          organization_id: orgId,
          status: true,
          created_at: {
            gte: startOfLastMonth,
            lt: endOfLastMonth
          }
        }
      }),
      
      prisma.donor.count({
        where: {
          organization_id: orgId,
          status: true,
          created_at: {
            gte: startOfMonth
          }
        }
      }),
      
      // GHL accounts growth comparison
      prisma.gHLAccount.count({
        where: {
          organization_id: orgId,
          status: 'active',
          created_at: {
            gte: startOfLastMonth,
            lt: endOfLastMonth
          }
        }
      }),
      
      prisma.gHLAccount.count({
        where: {
          organization_id: orgId,
          status: 'active',
          created_at: {
            gte: startOfMonth
          }
        }
      })
    ]);

    // Calculate percentage changes
    const calculateChange = (current, previous) => {
      if (previous === 0) return current > 0 ? '+100%' : '0%';
      const change = ((current - previous) / previous) * 100;
      return `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
    };

    const totalDonationsAmount = totalDonations._sum.trx_amount || 0;
    const thisMonthAmount = thisMonthDonations._sum.trx_amount || 0;
    const lastMonthAmount = lastMonthDonations._sum.trx_amount || 0;

    const stats = {
      totalDonors: {
        value: totalDonors.toLocaleString(),
        change: calculateChange(thisMonthDonors, lastMonthDonors),
        changeType: thisMonthDonors >= lastMonthDonors ? 'increase' : 'decrease'
      },
      totalDonations: {
        value: `$${totalDonationsAmount.toLocaleString()}`,
        change: calculateChange(totalDonationsAmount, lastMonthAmount),
        changeType: totalDonationsAmount >= lastMonthAmount ? 'increase' : 'decrease'
      },
      ghlAccounts: {
        value: ghlAccountsCount.toLocaleString(),
        change: calculateChange(thisMonthGhlAccounts, lastMonthGhlAccounts),
        changeType: thisMonthGhlAccounts >= lastMonthGhlAccounts ? 'increase' : 'decrease'
      },
      thisMonth: {
        value: `$${thisMonthAmount.toLocaleString()}`,
        change: calculateChange(thisMonthAmount, lastMonthAmount),
        changeType: thisMonthAmount >= lastMonthAmount ? 'increase' : 'decrease'
      }
    };

    // Get recent activity for this organization
    const recentActivity = await prisma.saveTrRecord.findMany({
      where: {
        trx_organization_id: orgId
      },
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        donor: {
          select: { name: true, email: true }
        }
      }
    });

    const formattedActivity = recentActivity.map(activity => ({
      id: activity.id,
      type: 'donation',
      title: 'New donation received',
      description: `${activity.donor.name} donated $${activity.trx_amount} to your cause`,
      time: formatTimeAgo(activity.created_at),
      color: 'green'
    }));

    // Add GHL account creation activity if available
    const recentGhlAccounts = await prisma.gHLAccount.findMany({
      where: {
        organization_id: orgId
      },
      take: 2,
      orderBy: { created_at: 'desc' }
    });

    recentGhlAccounts.forEach(account => {
      formattedActivity.push({
        id: `ghl-${account.id}`,
        type: 'ghl',
        title: 'GHL account created',
        description: `New GoHighLevel sub-account "${account.business_name}" created`,
        time: formatTimeAgo(account.created_at),
        color: 'blue'
      });
    });

    // Sort by most recent
    formattedActivity.sort((a, b) => new Date(b.time) - new Date(a.time));

    return NextResponse.json({
      success: true,
      organization,
      stats,
      recentActivity: formattedActivity.slice(0, 3)
    });

  } catch (error) {
    console.error('Error fetching organization dashboard stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    }, { status: 500 });
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);
  
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  if (minutes < 60) {
    return `${minutes} min ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}
