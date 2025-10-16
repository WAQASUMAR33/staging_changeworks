import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { verifyAdminToken } from "../../../lib/admin-auth";

export async function GET(request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization header missing or invalid' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyAdminToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has admin role
    if (!['ADMIN', 'SUPERADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }
    const [donorsCount, orgsCount, donationsAgg, activeCount] = await Promise.all([
      prisma.donor.count({ where: { status: true } }),
      prisma.organization.count({ where: { status: true } }),
      prisma.saveTrRecord.aggregate({ where: { pay_status: 'completed' }, _sum: { trx_amount: true } }),
      prisma.saveTrRecord.count({ where: { pay_status: { in: ['pending', 'processing'] } } })
    ]);

    const totalDonations = donationsAgg._sum.trx_amount || 0;
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

    return NextResponse.json({
      success: true,
      stats: {
        totalDonors: { value: donorsCount },
        totalOrganizations: { value: orgsCount },
        totalDonations: { value: currency.format(totalDonations), raw: totalDonations },
        activeTransactions: { value: activeCount }
      }
    });
  } catch (error) {
    console.error('admin dashboard-stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard stats' }, { status: 500 });
  }
}
