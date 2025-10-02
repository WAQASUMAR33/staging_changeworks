import { NextResponse } from "next/server";

export async function GET() {
  try {
    const config = {
      PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID ? 'Set' : 'Missing',
      PLAID_SECRET_KEY: process.env.PLAID_SECRET_KEY ? 'Set' : 'Missing',
      PLAID_ENV: process.env.NEXT_PUBLIC_PLAID_ENV || 'Not set',
      BASE_URL: process.env.NEXT_PUBLIC_BASE_URL || 'Not set',
    };

    return NextResponse.json({
      success: true,
      config,
      message: 'Plaid configuration check'
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
