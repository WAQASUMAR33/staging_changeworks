import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyAdminToken } from '../../../lib/admin-auth';

export async function GET(request) {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authorization header missing or invalid' },
        { status: 401 }
      );
    }

    const token = authHeader.substring(7);
    const decoded = verifyAdminToken(token);
    
    if (!decoded) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired token' },
        { status: 401 }
      );
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true }
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Check if user has admin role
    if (!['ADMIN', 'SUPERADMIN', 'MANAGER'].includes(user.role)) {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin role required.' },
        { status: 403 }
      );
    }
    const donors = await prisma.donor.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({
      success: true,
      donors: donors
    });
  } catch (error) {
    console.error('Error fetching donors:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch donors',
      details: error.message
    }, { status: 500 });
  }
}
