import { NextResponse } from 'next/server';
import { verifyTwoFactorToken } from '../../../lib/two-factor';
import { corsHeaders } from '@/app/lib/cors';

/**
 * Verify 2FA code during login
 * POST /api/two-factor/verify
 * Body: { token: '123456', secret: 'base32secret' }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token, secret } = body;

    if (!token || !secret) {
      return NextResponse.json(
        { error: 'Token and secret are required' },
        { status: 400 }
      );
    }

    // Verify the token
    const isValid = verifyTwoFactorToken(token, secret);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid two-factor authentication code' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication code verified',
    });
  } catch (error) {
    console.error('Error verifying 2FA token:', error);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication code' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
