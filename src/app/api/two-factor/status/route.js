import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import jwt from 'jsonwebtoken';
import { corsHeaders } from '@/app/lib/cors';

export const dynamic = 'force-dynamic';

/**
 * Get 2FA status for a user
 * GET /api/two-factor/status
 * Headers: Authorization: Bearer <token>
 */
export async function GET(request) {
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

    const searchParams = request.nextUrl.searchParams;
    const userType = searchParams.get('userType');

    // Determine user type from token if not provided
    const actualUserType = userType || decoded.userType || (decoded.type === 'organization' ? 'organization' : 'user');

    let user;
    let userId = decoded.id;

    // Fetch user 2FA status
    if (actualUserType === 'donor') {
      user = await prisma.donor.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });
    } else if (actualUserType === 'organization') {
      user = await prisma.organization.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });
    } else {
      user = await prisma.user.findUnique({
        where: { id: userId },
        select: { twoFactorEnabled: true },
      });
    }

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      twoFactorEnabled: user.twoFactorEnabled || false,
    });
  } catch (error) {
    console.error('Error getting 2FA status:', error);
    return NextResponse.json(
      { error: 'Failed to get two-factor authentication status' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
