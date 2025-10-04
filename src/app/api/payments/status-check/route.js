import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request) {
  try {
    console.log('🔍 Checking payment status...');

    // Get payment statistics
    const stats = await prisma.saveTrRecord.groupBy({
      by: ['pay_status'],
      _count: {
        pay_status: true
      },
      _sum: {
        trx_amount: true
      }
    });

    // Get recent payments
    const recentPayments = await prisma.saveTrRecord.findMany({
      orderBy: {
        created_at: 'desc'
      },
      take: 10,
      select: {
        id: true,
        trx_amount: true,
        pay_status: true,
        trx_donor_id: true,
        trx_organization_id: true,
        created_at: true,
        updated_at: true
      }
    });

    // Get organization info
    const organizations = await prisma.organization.findMany({
      select: {
        id: true,
        name: true,
        balance: true
      }
    });

    // Calculate totals
    const totalPending = stats.find(s => s.pay_status === 'pending')?._count.pay_status || 0;
    const totalCompleted = stats.find(s => s.pay_status === 'completed')?._count.pay_status || 0;
    const totalFailed = stats.find(s => s.pay_status === 'failed')?._count.pay_status || 0;
    
    const totalPendingAmount = stats.find(s => s.pay_status === 'pending')?._sum.trx_amount || 0;
    const totalCompletedAmount = stats.find(s => s.pay_status === 'completed')?._sum.trx_amount || 0;

    return NextResponse.json({
      success: true,
      message: 'Payment status check completed',
      summary: {
        total_payments: totalPending + totalCompleted + totalFailed,
        pending: {
          count: totalPending,
          amount: totalPendingAmount
        },
        completed: {
          count: totalCompleted,
          amount: totalCompletedAmount
        },
        failed: {
          count: totalFailed
        }
      },
      recent_payments: recentPayments,
      organizations: organizations,
      status: totalPending === 0 ? 'All payments completed' : `${totalPending} payments still pending`
    });

  } catch (error) {
    console.error('❌ Error checking payment status:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
