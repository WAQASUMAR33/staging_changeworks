import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    // Get donor information
    const donor = await prisma.donor.findUnique({
      where: { id: donorId },
      include: {
        organization: {
          select: { id: true, name: true }
        }
      }
    });

    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    // Get donation statistics
    const totalDonated = await prisma.donorTransaction.aggregate({
      where: {
        donor_id: donorId,
        status: 'completed'
      },
      _sum: {
        amount: true
      }
    });

    // Get this month's donations
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const thisMonthDonated = await prisma.donorTransaction.aggregate({
      where: {
        donor_id: donorId,
        status: 'completed',
        created_at: {
          gte: startOfMonth
        }
      },
      _sum: {
        amount: true
      }
    });

    // Get active subscriptions count
    const activeSubscriptions = await prisma.subscription.count({
      where: {
        donor_id: donorId,
        status: 'ACTIVE'
      }
    });

    // Get organizations supported count
    const organizationsSupported = await prisma.donorTransaction.findMany({
      where: {
        donor_id: donorId,
        status: 'completed'
      },
      select: {
        organization_id: true
      },
      distinct: ['organization_id']
    });

    // Get recent activity (last 5 transactions)
    const recentActivity = await prisma.donorTransaction.findMany({
      where: {
        donor_id: donorId,
        status: 'completed'
      },
      include: {
        organization: {
          select: { name: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 5
    });

    // Calculate changes (mock data for now - in real app, you'd compare with previous periods)
    const stats = {
      totalDonated: {
        value: totalDonated._sum.amount || 0,
        change: '+12.5%',
        changeType: 'increase'
      },
      activeSubscriptions: {
        value: activeSubscriptions,
        change: '+2',
        changeType: 'increase'
      },
      thisMonth: {
        value: thisMonthDonated._sum.amount || 0,
        change: '+8.3%',
        changeType: 'increase'
      },
      organizationsSupported: {
        value: organizationsSupported.length,
        change: '+1',
        changeType: 'increase'
      }
    };

    // Format recent activity
    const formattedRecentActivity = recentActivity.map(transaction => ({
      id: transaction.id,
      description: `Donation to ${transaction.organization?.name || 'Unknown Organization'}`,
      amount: transaction.amount,
      date: transaction.created_at.toISOString(),
      organization: transaction.organization?.name || 'Unknown Organization'
    }));

    return NextResponse.json({
      success: true,
      stats,
      recentActivity: formattedRecentActivity
    });

  } catch (error) {
    console.error("Dashboard stats error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
