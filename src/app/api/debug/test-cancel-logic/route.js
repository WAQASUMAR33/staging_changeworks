import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// POST /api/debug/test-cancel-logic - Test cancellation logic without Stripe
export async function POST(request) {
  try {
    const body = await request.json();
    const { subscription_id, cancel_immediately = false } = body;

    if (!subscription_id) {
      return NextResponse.json(
        { success: false, error: 'subscription_id is required' },
        { status: 400 }
      );
    }

    console.log(`Testing cancellation logic for subscription ${subscription_id}`);
    console.log(`Cancel immediately: ${cancel_immediately}`);

    // First, let's create a simple test record directly in the database
    try {
      // Insert a test subscription directly using raw SQL
      const insertResult = await prisma.$executeRaw`
        INSERT INTO subscriptions (
          stripe_subscription_id, 
          donor_id, 
          organization_id, 
          package_id, 
          status, 
          current_period_start, 
          current_period_end, 
          cancel_at_period_end, 
          amount, 
          currency, 
          interval, 
          interval_count, 
          created_at, 
          updated_at
        ) VALUES (
          'sub_test_${subscription_id}', 
          1, 
          1, 
          1, 
          'ACTIVE', 
          NOW(), 
          DATE_ADD(NOW(), INTERVAL 30 DAY), 
          0, 
          10.00, 
          'USD', 
          'month', 
          1, 
          NOW(), 
          NOW()
        )
      `;
      
      console.log(`Inserted test subscription: ${insertResult}`);
    } catch (insertError) {
      console.log('Test subscription might already exist or insert failed:', insertError.message);
    }

    // Now try to update the subscription status
    try {
      const updateData = {
        cancel_at_period_end: !cancel_immediately,
        canceled_at: cancel_immediately ? new Date() : null,
        status: cancel_immediately ? 'CANCELED' : 'CANCELED_AT_PERIOD_END',
        updated_at: new Date()
      };

      console.log('Update data:', updateData);

      const updatedSubscription = await prisma.subscription.update({
        where: { id: parseInt(subscription_id) },
        data: updateData
      });

      console.log(`Successfully updated subscription ${subscription_id}`);
      console.log(`New status: ${updatedSubscription.status}`);
      console.log(`Cancel at period end: ${updatedSubscription.cancel_at_period_end}`);

      return NextResponse.json({
        success: true,
        message: 'Cancellation logic test successful',
        original_data: {
          subscription_id: subscription_id,
          cancel_immediately: cancel_immediately
        },
        update_data: updateData,
        updated_subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancel_at_period_end: updatedSubscription.cancel_at_period_end,
          canceled_at: updatedSubscription.canceled_at,
          updated_at: updatedSubscription.updated_at
        }
      });

    } catch (updateError) {
      console.error(`Database update failed:`, updateError);
      return NextResponse.json({
        success: false,
        error: 'Database update failed',
        details: updateError.message,
        update_data: {
          cancel_at_period_end: !cancel_immediately,
          canceled_at: cancel_immediately ? new Date() : null,
          status: cancel_immediately ? 'CANCELED' : 'CANCELED_AT_PERIOD_END',
          updated_at: new Date()
        }
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error in test cancellation logic:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to test cancellation logic', details: error.message },
      { status: 500 }
    );
  }
}
