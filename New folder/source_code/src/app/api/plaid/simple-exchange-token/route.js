import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

export async function POST(request) {
  try {
    // Verify JWT token
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    const { public_token, metadata, organization_id } = await request.json();

    if (!public_token) {
      return NextResponse.json(
        { success: false, error: 'Public token is required' },
        { status: 400 }
      );
    }

    // Generate mock data for testing
    const mockAccessToken = `access-sandbox-${Date.now()}-${donorId}`;
    const mockItemId = `item-${Date.now()}-${donorId}`;
    const mockAccounts = [
      {
        account_id: `mock-account-1-${Date.now()}`,
        name: 'Mock Checking Account',
        type: 'depository',
        subtype: 'checking',
        mask: '0000',
        official_name: 'Mock Bank Checking Account',
        organization_id: organization_id
      },
      {
        account_id: `mock-account-2-${Date.now()}`,
        name: 'Mock Savings Account',
        type: 'depository',
        subtype: 'savings',
        mask: '1111',
        official_name: 'Mock Bank Savings Account',
        organization_id: organization_id
      }
    ];

    // Use raw SQL to insert the record, bypassing Prisma relations
    const insertQuery = `
      INSERT INTO plaid_connections (
        donor_id,
        organization_id,
        access_token,
        item_id,
        institution_id,
        institution_name,
        accounts,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    `;

    const result = await prisma.$executeRawUnsafe(
      insertQuery,
      donorId,
      organization_id,
      mockAccessToken,
      mockItemId,
      'ins_mock_bank',
      'Mock Bank',
      JSON.stringify(mockAccounts),
      'ACTIVE'
    );

    // Get the inserted record
    const insertedRecord = await prisma.$queryRawUnsafe(
      'SELECT * FROM plaid_connections WHERE access_token = ?',
      mockAccessToken
    );

    return NextResponse.json({
      success: true,
      message: 'Bank account connected successfully',
      connection: {
        id: insertedRecord[0]?.id,
        institution_name: 'Mock Bank',
        accounts_count: mockAccounts.length,
        status: 'ACTIVE',
        is_mock: true
      },
    });

  } catch (error) {
    console.error('Error in simple exchange token:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to exchange token', details: error.message },
      { status: 500 }
    );
  }
}
