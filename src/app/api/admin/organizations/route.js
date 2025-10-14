import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';

// GET - Fetch organizations with pagination for admin
export async function GET(req) {
  try {
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
        company: true,
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
