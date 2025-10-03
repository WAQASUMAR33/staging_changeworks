import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// GET /api/debug/test-db-connection - Test database connection and basic operations
export async function GET(request) {
  try {
    console.log('Testing database connection...');
    
    // Test 1: Basic connection
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test 2: Count subscriptions
    const subscriptionCount = await prisma.subscription.count();
    console.log(`✅ Found ${subscriptionCount} subscriptions in database`);
    
    // Test 3: Get a sample subscription
    const sampleSubscription = await prisma.subscription.findFirst({
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });
    
    if (sampleSubscription) {
      console.log(`✅ Sample subscription found: ID ${sampleSubscription.id}, Status: ${sampleSubscription.status}`);
    } else {
      console.log('⚠️ No subscriptions found in database');
    }
    
    // Test 4: Test a simple update (just update timestamp)
    if (sampleSubscription) {
      try {
        const updatedSubscription = await prisma.subscription.update({
          where: { id: sampleSubscription.id },
          data: {
            updated_at: new Date()
          }
        });
        console.log(`✅ Database update test successful for subscription ${sampleSubscription.id}`);
        console.log(`Updated at: ${updatedSubscription.updated_at}`);
      } catch (updateError) {
        console.error(`❌ Database update test failed:`, updateError);
        return NextResponse.json({
          success: false,
          error: 'Database update test failed',
          details: updateError.message,
          subscription_count: subscriptionCount,
          sample_subscription: sampleSubscription
        }, { status: 500 });
      }
    }
    
    // Test 5: Check database schema
    const tableInfo = await prisma.$queryRaw`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'subscriptions' 
      AND TABLE_SCHEMA = DATABASE()
      ORDER BY ORDINAL_POSITION
    `;
    
    console.log('✅ Database schema check completed');
    
    return NextResponse.json({
      success: true,
      message: 'Database connection and operations test successful',
      results: {
        connection: 'success',
        subscription_count: subscriptionCount,
        sample_subscription: sampleSubscription,
        schema_columns: tableInfo
      }
    });

  } catch (error) {
    console.error('❌ Database connection test failed:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Database connection test failed', 
        details: error.message,
        error_type: error.constructor.name
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
