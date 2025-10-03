import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// POST /api/debug/create-simple-test-subscription - Create a simple test subscription using raw SQL
export async function POST(request) {
  try {
    console.log('Creating simple test subscription using raw SQL...');
    
    // Create test subscription using raw SQL
    const result = await prisma.$executeRaw`
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
        'sub_test_${Date.now()}', 
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
    
    console.log(`Created test subscription with result: ${result}`);
    
    // Get the created subscription
    const subscription = await prisma.subscription.findFirst({
      where: {
        stripe_subscription_id: {
          startsWith: 'sub_test_'
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });
    
    if (subscription) {
      console.log(`Found created subscription with ID: ${subscription.id}`);
      
      return NextResponse.json({
        success: true,
        message: 'Simple test subscription created successfully',
        subscription: {
          id: subscription.id,
          stripe_subscription_id: subscription.stripe_subscription_id,
          status: subscription.status,
          cancel_at_period_end: subscription.cancel_at_period_end,
          created_at: subscription.created_at
        }
      });
    } else {
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve created subscription'
      }, { status: 500 });
    }

  } catch (error) {
    console.error('Error creating simple test subscription:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create simple test subscription', details: error.message },
      { status: 500 }
    );
  }
}
