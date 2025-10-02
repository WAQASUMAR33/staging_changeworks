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

    // Generate mock data
    const mockAccessToken = `access-sandbox-mock-${Date.now()}-${donorId}`;
    const mockItemId = `item-mock-${Date.now()}-${donorId}`;
    const mockAccounts = [
      {
        account_id: `mock-account-1-${Date.now()}`,
        name: 'Mock Checking Account',
        type: 'depository',
        subtype: 'checking',
        mask: '0000',
        official_name: 'Mock Bank Checking Account'
      },
      {
        account_id: `mock-account-2-${Date.now()}`,
        name: 'Mock Savings Account',
        type: 'depository',
        subtype: 'savings',
        mask: '1111',
        official_name: 'Mock Bank Savings Account'
      }
    ];

    // Save mock Plaid connection to database
    // Store organization_id in accounts JSON for now until database migration is complete
    const mockAccountsWithOrgId = mockAccounts.map(account => ({
      ...account,
      organization_id: organization_id,
      is_mock: true
    }));

    const connectionData = {
      donor_id: donorId,
      access_token: mockAccessToken,
      item_id: mockItemId,
      institution_id: 'ins_mock_bank',
      institution_name: 'Mock Bank',
      accounts: JSON.stringify(mockAccountsWithOrgId),
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Try to create with organization_id first, fallback to without it
    let plaidConnection;
    try {
      plaidConnection = await prisma.plaidConnection.create({
        data: {
          ...connectionData,
          organization_id: organization_id,
          donor: {
            connect: { id: donorId }
          },
          organization: {
            connect: { id: organization_id }
          }
        },
      });
    } catch (error) {
      console.log('Error creating with relations, trying direct approach:', error.message);
      // Try direct approach without relations
      try {
        plaidConnection = await prisma.plaidConnection.create({
          data: {
            ...connectionData,
            organization_id: organization_id,
          },
        });
      } catch (directError) {
        console.log('Direct approach failed, trying without organization_id:', directError.message);
        // Remove organization_id from data if field doesn't exist
        const { organization_id: _, ...dataWithoutOrgId } = connectionData;
        plaidConnection = await prisma.plaidConnection.create({
          data: dataWithoutOrgId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Mock bank account connected successfully',
      connection: {
        id: plaidConnection.id,
        institution_name: plaidConnection.institution_name,
        accounts_count: mockAccounts.length,
        status: plaidConnection.status,
        is_mock: true
      },
    });

  } catch (error) {
    console.error('Error exchanging mock Plaid token:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to exchange mock token', details: error.message },
      { status: 500 }
    );
  }
}
