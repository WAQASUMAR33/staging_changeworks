import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma.jsx";

// GET /api/subscriptions/donor-status - Get donor status with just donor_id
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const donorId = searchParams.get('donor_id');

    if (!donorId) {
      return NextResponse.json(
        { success: false, error: 'donor_id is required' },
        { status: 400 }
      );
    }

    // Get donor info
    const donor = await prisma.donor.findUnique({
      where: { id: parseInt(donorId) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        created_at: true
      }
    });

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Get subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: { donor_id: parseInt(donorId) },
      include: {
        organization: {
          select: { id: true, name: true, email: true }
        },
        package: {
          select: { id: true, name: true, price: true, currency: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where: { donor_id: parseInt(donorId) },
      include: {
        organization: {
          select: { id: true, name: true }
        }
      },
      orderBy: { created_at: 'desc' }
    });

    // Calculate status
    const activeSubscriptions = subscriptions.filter(s => s.status === 'ACTIVE');
    const overallStatus = activeSubscriptions.length > 0 ? 'ACTIVE' : 'INACTIVE';

    return NextResponse.json({
      success: true,
      donor: donor,
      overall_status: overallStatus,
      subscriptions: {
        total: subscriptions.length,
        active: activeSubscriptions.length,
        all: subscriptions
      },
      payments: {
        total_transactions: transactions.length,
        transactions: transactions
      },
      summary: {
        total_amount_paid: transactions.reduce((sum, t) => sum + (t.amount || 0), 0),
        membership_duration_days: Math.floor((new Date() - new Date(donor.created_at)) / (1000 * 60 * 60 * 24))
      }
    });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get donor status', details: error.message },
      { status: 500 }
    );
  }
}
