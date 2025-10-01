import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";


// GET: Fetch all transactions for a specific donor_id
export async function GET(request, { params }) {
  try {
    const { id } = await params;

    // Validate donor_id
    const donorId = parseInt(id);
    if (isNaN(donorId)) {
      return NextResponse.json(
        { error: 'Invalid donor_id' },
        { status: 400 }
      );
    }

    // Fetch all transactions for the donor
    const transactions = await prisma.donorTransaction.findMany({
      where: {
        donor_id: donorId,
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
        { message: 'No transactions found for this donor' },
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