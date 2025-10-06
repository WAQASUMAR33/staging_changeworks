import { NextResponse } from 'next/server';
import { prisma } from '../../../../lib/prisma';

export async function GET() {
  try {
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
