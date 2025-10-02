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
      signal: AbortSignal.timeout(30000), // 30 second timeout
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
      signal: AbortSignal.timeout(30000), // 30 second timeout
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
    // Store organization_id in accounts JSON for now until database migration is complete
    const accountsWithOrgId = accounts.map(account => ({
      ...account,
      organization_id: organization_id
    }));

    const connectionData = {
      donor_id: donorId,
      access_token: access_token,
      item_id: item_id,
      institution_id: metadata.institution?.institution_id || null,
      institution_name: metadata.institution?.name || null,
      accounts: JSON.stringify(accountsWithOrgId),
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
    
    // Handle network connectivity issues
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('timeout') || error.message.includes('fetch failed')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Network connection timeout. Please check your internet connection and try again.',
          details: 'Unable to connect to Plaid API. This may be due to network issues or firewall restrictions.',
          errorCode: 'NETWORK_TIMEOUT'
        },
        { status: 503 }
      );
    }
    
    // Handle other network errors
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unable to connect to Plaid service. Please try again later.',
          details: 'DNS resolution or connection refused error.',
          errorCode: 'NETWORK_ERROR'
        },
        { status: 503 }
      );
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
