import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

// Plaid configuration
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET_KEY = process.env.PLAID_SECRET_KEY;
const PLAID_ENV = process.env.NEXT_PUBLIC_PLAID_ENV || 'sandbox';

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

    // Exchange public token for access token
    const exchangeResponse = await fetch('https://sandbox.plaid.com/item/public_token/exchange', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET_KEY,
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET_KEY,
        public_token: public_token,
      }),
    });

    if (!exchangeResponse.ok) {
      const errorData = await exchangeResponse.json();
      console.error('Plaid token exchange failed:', errorData);
      return NextResponse.json(
        { success: false, error: 'Failed to exchange token', details: errorData },
        { status: 500 }
      );
    }

    const { access_token, item_id } = await exchangeResponse.json();

    // Get account information
    const accountsResponse = await fetch('https://sandbox.plaid.com/accounts/get', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET_KEY,
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET_KEY,
        access_token: access_token,
      }),
    });

    if (!accountsResponse.ok) {
      const errorData = await accountsResponse.json();
      console.error('Plaid accounts get failed:', errorData);
      return NextResponse.json(
        { success: false, error: 'Failed to get account information', details: errorData },
        { status: 500 }
      );
    }

    const { accounts } = await accountsResponse.json();

    // Save Plaid connection to database
    // Temporarily store organization_id in metadata until database migration is complete
    const connectionData = {
      donor_id: donorId,
      access_token: access_token,
      item_id: item_id,
      institution_id: metadata.institution?.institution_id || null,
      institution_name: metadata.institution?.name || null,
      accounts: JSON.stringify(accounts),
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
      // Store organization_id in metadata for now
      metadata: JSON.stringify({
        organization_id: organization_id,
        original_metadata: metadata
      })
    };

    // Try to create with organization_id first, fallback to without it
    let plaidConnection;
    try {
      plaidConnection = await prisma.plaidConnection.create({
        data: {
          ...connectionData,
          organization_id: organization_id,
        },
      });
    } catch (error) {
      console.log('organization_id field not found, creating without it:', error.message);
      // Remove organization_id from data if field doesn't exist
      const { organization_id: _, ...dataWithoutOrgId } = connectionData;
      plaidConnection = await prisma.plaidConnection.create({
        data: dataWithoutOrgId,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account connected successfully',
      connection: {
        id: plaidConnection.id,
        institution_name: plaidConnection.institution_name,
        accounts_count: accounts.length,
        status: plaidConnection.status,
      },
    });

  } catch (error) {
    console.error('Error exchanging Plaid token:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    
    // Check for specific database errors
    if (error.message.includes('Unknown argument') || error.message.includes('organization_id')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database schema error: organization_id field missing. Please run the migration script.',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to exchange token', details: error.message },
      { status: 500 }
    );
  }
}
