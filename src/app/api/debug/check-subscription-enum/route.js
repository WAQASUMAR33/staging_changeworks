import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// GET /api/debug/check-subscription-enum - Check subscription enum values
export async function GET(request) {
  try {
    console.log('Checking subscription enum values...');
    
    // Check the enum values in the database
    const enumValues = await prisma.$queryRaw`
      SELECT COLUMN_TYPE 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'subscriptions' 
      AND COLUMN_NAME = 'status'
      AND TABLE_SCHEMA = DATABASE()
    `;
    
    console.log('Enum values:', enumValues);
    
    // Try to create a test subscription with different status values
    const testStatuses = ['ACTIVE', 'CANCELED', 'CANCELED_AT_PERIOD_END', 'INCOMPLETE', 'PAST_DUE', 'TRIALING', 'UNPAID'];
    const testResults = [];
    
    for (const status of testStatuses) {
      try {
        // Try to update a non-existent subscription to test if the enum value is valid
        await prisma.subscription.update({
          where: { id: 999999 }, // Non-existent ID
          data: { status: status }
        });
        testResults.push({ status, valid: true, error: null });
      } catch (error) {
        if (error.message.includes('Record to update not found')) {
          // This is expected - the record doesn't exist, but the enum value is valid
          testResults.push({ status, valid: true, error: 'Record not found (expected)' });
        } else if (error.message.includes('Invalid value for argument `status`')) {
          // This means the enum value is not valid
          testResults.push({ status, valid: false, error: error.message });
        } else {
          testResults.push({ status, valid: false, error: error.message });
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'Subscription enum check completed',
      results: {
        enum_definition: enumValues,
        status_tests: testResults,
        valid_statuses: testResults.filter(r => r.valid).map(r => r.status),
        invalid_statuses: testResults.filter(r => !r.valid).map(r => ({ status: r.status, error: r.error }))
      }
    });

  } catch (error) {
    console.error('Error checking subscription enum:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check subscription enum', details: error.message },
      { status: 500 }
    );
  }
}
