import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// GET: Fetch all transactions for a specific organization_id
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Validate organization_id
    const organizationId = parseInt(id);
    if (isNaN(organizationId)) {
      return NextResponse.json(
        { error: 'Invalid organization_id' },
        { status: 400 }
      );
    }

    // Fetch all transactions for the organization
    const transactions = await prisma.donorTransaction.findMany({
      where: {
        organization_id: organizationId,
      },
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc', // Optional: Order by creation date
      },
    });

    // Check if transactions exist
    if (!transactions || transactions.length === 0) {
      return NextResponse.json(
        { message: 'No transactions found for this organization' },
        { status: 404 }
      );
    }

    return NextResponse.json(transactions, { status: 200 });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}