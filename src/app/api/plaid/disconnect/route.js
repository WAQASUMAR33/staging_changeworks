import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { donor_id } = await request.json();

    if (!donor_id) {
      return NextResponse.json(
        { error: 'Donor ID is required' },
        { status: 400 }
      );
    }

    // Find and delete the Plaid connection for this donor
    const deletedConnection = await prisma.plaidConnection.deleteMany({
      where: {
        donor_id: parseInt(donor_id)
      }
    });

    console.log(`Deleted ${deletedConnection.count} Plaid connection(s) for donor ${donor_id}`);

    return NextResponse.json({
      success: true,
      message: 'Plaid connection disconnected successfully',
      deletedCount: deletedConnection.count
    });

  } catch (error) {
    console.error('Error disconnecting Plaid:', error);
    
    // Handle case where no connection exists
    if (error.code === 'P2025') {
      return NextResponse.json({
        success: true,
        message: 'No Plaid connection found to disconnect',
        deletedCount: 0
      });
    }

    return NextResponse.json(
      { error: 'Failed to disconnect Plaid connection' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
