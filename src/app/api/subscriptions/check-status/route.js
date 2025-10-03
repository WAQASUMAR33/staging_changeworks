import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    // Verify JWT token
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    // Check if donor has any active subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        donor_id: donorId,
        status: {
          in: ['ACTIVE', 'TRIALING', 'PAST_DUE']
        }
      },
      select: {
        id: true,
        stripe_subscription_id: true,
        status: true,
        amount: true,
        currency: true,
        interval: true,
        interval_count: true,
        current_period_start: true,
        current_period_end: true,
        cancel_at_period_end: true,
        created_at: true,
        organization: {
          select: {
            id: true,
            name: true
          }
        },
        package: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const hasActiveSubscription = subscriptions.length > 0;
    
    // Calculate total monthly amount
    const totalMonthlyAmount = subscriptions.reduce((total, sub) => {
      let monthlyAmount = sub.amount;
      
      // Convert to monthly amount based on interval
      if (sub.interval === 'year') {
        monthlyAmount = sub.amount / 12;
      } else if (sub.interval === 'week') {
        monthlyAmount = sub.amount * 4.33; // Approximate weeks per month
      } else if (sub.interval === 'day') {
        monthlyAmount = sub.amount * 30; // Approximate days per month
      }
      
      return total + monthlyAmount;
    }, 0);
    
    return NextResponse.json({
      success: true,
      has_active_subscription: hasActiveSubscription,
      subscriptions: subscriptions,
      subscription_count: subscriptions.length,
      total_monthly_amount: totalMonthlyAmount,
      next_billing_date: subscriptions.length > 0 ? subscriptions[0].current_period_end : null
    });

  } catch (error) {
    console.error('Error checking subscription status:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to check subscription status', details: error.message },
      { status: 500 }
    );
  }
}
