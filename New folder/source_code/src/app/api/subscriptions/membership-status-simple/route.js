import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma.jsx";

// GET /api/subscriptions/membership-status-simple - Simple test version
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

    // Test prisma connection
    console.log('Testing prisma connection...');
    
    // Get donor information
    const donor = await prisma.donor.findUnique({
      where: { id: parseInt(donorId) },
      select: {
        id: true,
        name: true,
        email: true,
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
      where: {
        donor_id: parseInt(donorId)
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        created_at: true
      }
    });

    // Get transactions
    const transactions = await prisma.transaction.findMany({
      where: {
        donor_id: parseInt(donorId)
      },
      select: {
        id: true,
        amount: true,
        currency: true,
        status: true,
        created_at: true
      }
    });

    return NextResponse.json({
      success: true,
      donor: donor,
      subscriptions: subscriptions,
      transactions: transactions,
      summary: {
        total_subscriptions: subscriptions.length,
        total_transactions: transactions.length,
        active_subscriptions: subscriptions.filter(s => s.status === 'ACTIVE').length
      }
    });

  } catch (error) {
    console.error('Error in simple membership status API:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch membership status', 
        details: error.message,
        stack: error.stack
      },
      { status: 500 }
    );
  }
}
