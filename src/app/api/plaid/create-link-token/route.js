import { NextResponse } from "next/server";
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

    // Get organization_id from request body
    const { organization_id } = await request.json();
    if (!organization_id) {
      return NextResponse.json({ success: false, error: 'Organization ID is required' }, { status: 400 });
    }

    // Create link token using Plaid API with timeout and retry
    const plaidResponse = await fetch('https://sandbox.plaid.com/link/token/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': PLAID_CLIENT_ID,
        'PLAID-SECRET': PLAID_SECRET_KEY,
      },
      body: JSON.stringify({
        client_id: PLAID_CLIENT_ID,
        secret: PLAID_SECRET_KEY,
        client_name: 'ChangeWorks Fund',
        products: ['transactions', 'auth'],
        country_codes: ['US'],
        language: 'en',
        user: {
          client_user_id: donorId.toString(),
        },
        webhook: `${process.env.NEXT_PUBLIC_BASE_URL}/api/plaid/webhook`,
      }),
      // Add timeout and retry configuration
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    if (!plaidResponse.ok) {
      const errorData = await plaidResponse.json();
      console.error('Plaid link token creation failed:', errorData);
      return NextResponse.json(
        { success: false, error: 'Failed to create link token', details: errorData },
        { status: 500 }
      );
    }

    const { link_token } = await plaidResponse.json();

    return NextResponse.json({
      success: true,
      link_token,
    });

  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    
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
    
    return NextResponse.json(
      { success: false, error: 'Failed to create link token', details: error.message },
      { status: 500 }
    );
  }
}
