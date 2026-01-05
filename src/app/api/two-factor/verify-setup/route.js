import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyTwoFactorSetup } from '../../../lib/two-factor';
import jwt from 'jsonwebtoken';

/**
 * Verify 2FA setup by confirming the code from authenticator app
 * POST /api/two-factor/verify-setup
 * Body: { token: '123456', userType: 'user' | 'donor' | 'organization' }
 * Headers: Authorization: Bearer <token>
 */
export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized. Please log in.' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { token: twoFactorToken, userType } = body;

    if (!twoFactorToken) {
      return NextResponse.json(
        { error: 'Two-factor authentication code is required' },
        { status: 400 }
      );
    }

    // Determine user type from token if not provided
    const actualUserType = userType || decoded.userType || (decoded.type === 'organization' ? 'organization' : 'user');

    let user;
    let userId = decoded.id;

    // Fetch user with secret
    if (actualUserType === 'donor') {
      user = await prisma.donor.findUnique({
        where: { id: userId },
        select: { id: true, email: true, twoFactorSecret: true, twoFactorEnabled: true },
      });
    } else if (actualUserType === 'organization') {
      user = await prisma.organization.findUnique({
        where: { id: userId },
        select: { id: true, email: true, twoFactorSecret: true, twoFactorEnabled: true },
      });
    } else {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, twoFactorSecret: true, twoFactorEnabled: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.twoFactorSecret) {
      return NextResponse.json(
        { error: 'Two-factor authentication secret not found. Please enable 2FA first.' },
        { status: 400 }
      );
    }

    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 }
      );
    }

    // Verify the token
    const isValid = verifyTwoFactorSetup(twoFactorToken, user.twoFactorSecret);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid two-factor authentication code. Please try again.' },
        { status: 400 }
      );
    }

    // Enable 2FA
    if (actualUserType === 'donor') {
      await prisma.donor.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });
    } else if (actualUserType === 'organization') {
      await prisma.organization.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been successfully enabled',
    });
  } catch (error) {
    console.error('Error verifying 2FA setup:', error);
    return NextResponse.json(
      { error: 'Failed to verify two-factor authentication setup' },
      { status: 500 }
    );
  }
}




