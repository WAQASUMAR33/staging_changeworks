import { NextResponse } from "next/server";

// Plaid configuration
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET_KEY = process.env.PLAID_SECRET_KEY;
const PLAID_ENV = process.env.NEXT_PUBLIC_PLAID_ENV || 'sandbox';

export async function GET() {
  try {
    console.log('Testing Plaid link token creation...');
    console.log('PLAID_CLIENT_ID:', PLAID_CLIENT_ID ? 'Set' : 'Missing');
    console.log('PLAID_SECRET_KEY:', PLAID_SECRET_KEY ? 'Set' : 'Missing');
    console.log('PLAID_ENV:', PLAID_ENV);

    // Create link token using Plaid API
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
          client_user_id: 'test-user-123',
        },
        webhook: `${process.env.NEXT_PUBLIC_BASE_URL}/api/plaid/webhook`,
      }),
    });

    console.log('Plaid API response status:', plaidResponse.status);

    if (!plaidResponse.ok) {
      const errorData = await plaidResponse.json();
      console.error('Plaid link token creation failed:', errorData);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create link token', 
          details: errorData,
          status: plaidResponse.status
        },
        { status: 500 }
      );
    }

    const responseData = await plaidResponse.json();
    console.log('Plaid link token created successfully');

    return NextResponse.json({
      success: true,
      message: 'Plaid link token created successfully',
      link_token: responseData.link_token,
      expiration: responseData.expiration,
    });

  } catch (error) {
    console.error('Error creating Plaid link token:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to create link token', 
        details: error.message 
      },
      { status: 500 }
    );
  }
}
