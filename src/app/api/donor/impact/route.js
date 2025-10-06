import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    // Get token from Authorization header (optional; returns anonymized data if missing)
    const authHeader = request.headers.get('authorization');
    let donorId = null;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        donorId = decoded.id;
      } catch (e) {
        // If token invalid, return 401
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
    }

    if (!donorId) {
      // No donor context; return zeros to avoid blocking UI
      return NextResponse.json({
        success: true,
        impact: {
          totalDonated: { value: 0, change: '+0%', changeType: 'neutral' },
          livesImpacted: { value: 0, change: '+0%', changeType: 'neutral' },
          organizationsSupported: { value: 0, change: '+0%', changeType: 'neutral' },
          donationStreak: 0,
          recentStories: [],
          donationBreakdown: [],
          achievements: []
        }
      });
    }

    // Ensure donor exists
    const donor = await prisma.donor.findUnique({ where: { id: donorId } });
    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    // Using the correct model/fields from our schema: saveTrRecord
    // Sum of completed payments for this donor (stored in dollars in trx_amount)
    const totalDonatedAgg = await prisma.saveTrRecord.aggregate({
      where: {
        trx_donor_id: donorId,
        pay_status: 'completed'
      },
      _sum: { trx_amount: true }
    });
    const totalAmount = totalDonatedAgg._sum.trx_amount || 0;

    // Distinct organizations supported
    const organizationsSupported = await prisma.saveTrRecord.findMany({
      where: {
        trx_donor_id: donorId,
        pay_status: 'completed'
      },
      select: { trx_organization_id: true },
      distinct: ['trx_organization_id']
    });

    // Donations by month for streak calculation
    const donationsByMonth = await prisma.saveTrRecord.findMany({
      where: {
        trx_donor_id: donorId,
        pay_status: 'completed'
      },
      select: { created_at: true },
      orderBy: { created_at: 'desc' }
    });

    // Calculate monthly streak
    let streak = 0;
    const now = new Date();
    let currentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    for (const donation of donationsByMonth) {
      const d = new Date(donation.created_at);
      const donationMonth = new Date(d.getFullYear(), d.getMonth(), 1);
      if (donationMonth.getTime() === currentMonth.getTime()) {
        streak++;
        currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
      } else {
        break;
      }
    }

    const impact = {
      totalDonated: {
        value: totalAmount,
        change: '+0%',
        changeType: 'neutral'
      },
      livesImpacted: {
        value: Math.floor(totalAmount / 50),
        change: '+0%',
        changeType: 'neutral'
      },
      organizationsSupported: {
        value: organizationsSupported.length,
        change: '+0%',
        changeType: 'neutral'
      },
      donationStreak: streak,
      recentStories: [],
      donationBreakdown: [
        { category: "Education", amount: totalAmount * 0.4, percentage: 40, color: "#3B82F6" },
        { category: "Healthcare", amount: totalAmount * 0.3, percentage: 30, color: "#10B981" },
        { category: "Environment", amount: totalAmount * 0.2, percentage: 20, color: "#059669" },
        { category: "Other", amount: totalAmount * 0.1, percentage: 10, color: "#8B5CF6" }
      ],
      achievements: []
    };

    return NextResponse.json({ success: true, impact });

  } catch (error) {
    console.error("Impact data fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
