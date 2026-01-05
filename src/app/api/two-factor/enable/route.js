import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { generateTwoFactorSecret } from '../../../lib/two-factor';
import jwt from 'jsonwebtoken';

/**
 * Enable 2FA for a user
 * POST /api/two-factor/enable
 * Body: { userType: 'user' | 'donor' | 'organization' }
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
    const { userType } = body;

    // Determine user type from token if not provided
    const actualUserType = userType || decoded.userType || (decoded.type === 'organization' ? 'organization' : 'user');

    let user;
    let userId = decoded.id;

    // Fetch user based on type
    if (actualUserType === 'donor') {
      user = await prisma.donor.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, twoFactorEnabled: true },
      });
    } else if (actualUserType === 'organization') {
      user = await prisma.organization.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, twoFactorEnabled: true },
      });
    } else {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, twoFactorEnabled: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if 2FA is already enabled
    if (user.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is already enabled' },
        { status: 400 }
      );
    }

    // Generate 2FA secret
    const serviceName = 'ChangeWorks';
    const twoFactorData = await generateTwoFactorSecret(user.email, serviceName);

    // Store the secret temporarily (not enabled yet - user needs to verify first)
    if (actualUserType === 'donor') {
      await prisma.donor.update({
        where: { id: userId },
        data: { twoFactorSecret: twoFactorData.secret },
      });
    } else if (actualUserType === 'organization') {
      await prisma.organization.update({
        where: { id: userId },
        data: { twoFactorSecret: twoFactorData.secret },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { twoFactorSecret: twoFactorData.secret },
      });
    }

    return NextResponse.json({
      success: true,
      secret: twoFactorData.secret,
      qrCode: twoFactorData.qrCode,
      otpauth_url: twoFactorData.otpauth_url,
      message: 'Scan the QR code with your authenticator app and verify with a code to complete setup',
    });
  } catch (error) {
    console.error('Error enabling 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to enable two-factor authentication' },
      { status: 500 }
    );
  }
}




