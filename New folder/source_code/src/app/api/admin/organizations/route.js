import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyAdminToken } from '../../../lib/admin-auth';

// GET - Fetch organizations with pagination for admin
export async function GET(req) {
  try {
    // Get authorization header
    const authHeader = req.headers.get('authorization');
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
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 10;
    const skip = (page - 1) * limit;

    // Get total count
    const totalCount = await prisma.organization.count();

    // Get organizations with pagination
    const organizations = await prisma.organization.findMany({
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        website: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        ghlId: true,
        imageUrl: true,
        status: true,
        created_at: true,
        updated_at: true
      }
    });

    return NextResponse.json({
      success: true,
      organizations,
      totalCount,
      page,
      limit,
      totalPages: Math.ceil(totalCount / limit)
    });

  } catch (error) {
    console.error('Error fetching organizations:', error);
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to fetch organizations',
        details: error.message
      },
      { status: 500 }
    );
  }
}
