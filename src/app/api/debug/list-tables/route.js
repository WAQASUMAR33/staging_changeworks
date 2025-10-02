import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    // Get all tables in the database
    const tables = await prisma.$queryRaw`
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        DATA_LENGTH,
        INDEX_LENGTH,
        CREATE_TIME,
        UPDATE_TIME
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      ORDER BY TABLE_NAME
    `;

    // Get detailed info about plaid_connections table specifically
    let plaidTableDetails = null;
    try {
      plaidTableDetails = await prisma.$queryRaw`
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          COLUMN_KEY,
          EXTRA,
          COLUMN_COMMENT
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'plaid_connections'
        ORDER BY ORDINAL_POSITION
      `;
    } catch (error) {
      plaidTableDetails = { error: error.message };
    }

    return NextResponse.json({
      success: true,
      database_name: process.env.DATABASE_URL ? process.env.DATABASE_URL.split('/').pop().split('?')[0] : 'unknown',
      total_tables: tables.length,
      tables: tables,
      plaid_connections_details: plaidTableDetails,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error listing tables:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to list tables', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
