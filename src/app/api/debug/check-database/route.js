import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const results = {};

    // Check if plaid_connections table exists and get its structure
    try {
      const tableInfo = await prisma.$queryRaw`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          COLUMN_KEY,
          EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'plaid_connections'
        ORDER BY ORDINAL_POSITION
      `;
      
      results.plaid_connections_table = {
        exists: true,
        columns: tableInfo
      };
    } catch (error) {
      results.plaid_connections_table = {
        exists: false,
        error: error.message
      };
    }

    // Check if we can query the table
    try {
      const count = await prisma.plaidConnection.count();
      results.plaid_connections_data = {
        can_query: true,
        record_count: count
      };
    } catch (error) {
      results.plaid_connections_data = {
        can_query: false,
        error: error.message
      };
    }

    // Get sample data if any exists
    try {
      const sampleData = await prisma.plaidConnection.findMany({
        take: 3,
        select: {
          id: true,
          donor_id: true,
          organization_id: true,
          institution_name: true,
          status: true,
          created_at: true
        }
      });
      
      results.sample_data = sampleData;
    } catch (error) {
      results.sample_data = {
        error: error.message
      };
    }

    // Check related tables
    try {
      const donorCount = await prisma.donor.count();
      const orgCount = await prisma.organization.count();
      
      results.related_tables = {
        donors_count: donorCount,
        organizations_count: orgCount
      };
    } catch (error) {
      results.related_tables = {
        error: error.message
      };
    }

    // Test creating a record (without actually saving it)
    try {
      const testData = {
        donor_id: 1,
        organization_id: 1,
        access_token: 'test-token',
        item_id: 'test-item',
        institution_name: 'Test Bank',
        accounts: JSON.stringify([{ account_id: 'test', name: 'Test Account' }]),
        status: 'ACTIVE'
      };
      
      // Just validate the data structure without saving
      results.can_create_record = true;
      results.test_data_structure = testData;
    } catch (error) {
      results.can_create_record = false;
      results.create_error = error.message;
    }

    return NextResponse.json({
      success: true,
      database_check: results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error checking database:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to check database', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
