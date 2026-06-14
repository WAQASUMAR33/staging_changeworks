import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { verifyAdminToken } from "../../../lib/admin-auth";
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    console.log('🔍 Dashboard Stats API - Auth header:', authHeader);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ Dashboard Stats API - No auth header');
      return NextResponse.json(
        { success: false, error: 'Authorization header missing or invalid' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    console.log('🔍 Dashboard Stats API - Token:', token.substring(0, 20) + '...');
    
    const decoded = verifyAdminToken(token);
    console.log('🔍 Dashboard Stats API - Decoded token:', decoded);
    
    if (!decoded) {
      console.log('❌ Dashboard Stats API - Token verification failed');
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

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [donorsCount, orgsCount, donationsAgg, activeCount, todayDonationsAgg, fundTransfersCount, recentTransactions] = await Promise.all([
      prisma.donor.count({ where: { status: true } }),
      prisma.organization.count({ where: { status: true } }),
      prisma.saveTrRecord.aggregate({ where: { pay_status: 'completed' }, _sum: { trx_amount: true } }),
      prisma.saveTrRecord.count({ where: { pay_status: { in: ['pending', 'processing'] } } }),
      prisma.saveTrRecord.aggregate({ 
        where: { 
          pay_status: 'completed',
          created_at: { gte: today }
        }, 
        _sum: { trx_amount: true } 
      }),
      prisma.fundTransfer.count(),
      prisma.saveTrRecord.findMany({
        take: 5,
        orderBy: { created_at: 'desc' },
        where: { pay_status: 'completed' },
        include: { donor: { select: { name: true } } }
      })
    ]);

    const totalDonations = donationsAgg._sum.trx_amount || 0;
    const todayDonationsVal = todayDonationsAgg._sum.trx_amount || 0;
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });

    // Format recent activity
    const recentActivity = recentTransactions.map(tx => ({
      id: tx.id,
      title: 'New Donation',
      description: `${currency.format(tx.trx_amount)} from ${tx.donor?.name || 'Unknown Donor'}`,
      time: new Date(tx.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      color: 'green'
    }));

    return NextResponse.json({
      success: true,
      stats: {
        totalDonors: { value: donorsCount },
        totalOrganizations: { value: orgsCount },
        totalDonations: { value: currency.format(totalDonations), raw: totalDonations },
        activeTransactions: { value: activeCount },
        todayDonations: { value: currency.format(todayDonationsVal), raw: todayDonationsVal },
        fundTransfers: { value: fundTransfersCount }
      },
      recentActivity
    });
  } catch (error) {
    console.error('admin dashboard-stats error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load dashboard stats' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
