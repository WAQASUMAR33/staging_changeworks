import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import jwt from 'jsonwebtoken';

/**
 * Disable 2FA for a user
 * POST /api/two-factor/disable
 * Body: { password: 'userpassword', userType: 'user' | 'donor' | 'organization' }
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
    const { password, userType } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to disable two-factor authentication' },
        { status: 400 }
      );
    }

    // Determine user type from token if not provided
    const actualUserType = userType || decoded.userType || (decoded.type === 'organization' ? 'organization' : 'user');

    let user;
    let userId = decoded.id;
    const { compare } = await import('bcryptjs');

    // Fetch user with password
    if (actualUserType === 'donor') {
      user = await prisma.donor.findUnique({
        where: { id: userId },
        select: { id: true, email: true, password: true, twoFactorEnabled: true },
      });
    } else if (actualUserType === 'organization') {
      user = await prisma.organization.findUnique({
        where: { id: userId },
        select: { id: true, email: true, password: true, orgPassword: true, twoFactorEnabled: true },
      });
    } else {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, password: true, twoFactorEnabled: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.twoFactorEnabled) {
      return NextResponse.json(
        { error: 'Two-factor authentication is not enabled' },
        { status: 400 }
      );
    }

    // Verify password
    let isPasswordCorrect = false;
    if (actualUserType === 'organization') {
      isPasswordCorrect = await compare(password, user.password || '') || 
                          await compare(password, user.orgPassword || '');
    } else {
      isPasswordCorrect = await compare(password, user.password);
    }

    if (!isPasswordCorrect) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    // Disable 2FA and clear secret
    if (actualUserType === 'donor') {
      await prisma.donor.update({
        where: { id: userId },
        data: { 
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
    } else if (actualUserType === 'organization') {
      await prisma.organization.update({
        where: { id: userId },
        data: { 
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: userId },
        data: { 
          twoFactorEnabled: false,
          twoFactorSecret: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Two-factor authentication has been successfully disabled',
    });
  } catch (error) {
    console.error('Error disabling 2FA:', error);
    return NextResponse.json(
      { error: 'Failed to disable two-factor authentication' },
      { status: 500 }
    );
  }
}




