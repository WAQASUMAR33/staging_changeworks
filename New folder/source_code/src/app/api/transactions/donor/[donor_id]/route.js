import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// GET - Get transactions by donor ID
export async function GET(request, { params }) {
  try {
    const { donor_id } = await params;

    if (!donor_id) {
      return NextResponse.json({
        success: false,
        error: "Donor ID is required"
      }, { status: 400 });
    }

    const donorIdInt = parseInt(donor_id);
    if (isNaN(donorIdInt)) {
      return NextResponse.json({
        success: false,
        error: "Invalid donor ID format"
      }, { status: 400 });
    }

    const transactions = await prisma.saveTrRecord.findMany({
      where: {
        trx_donor_id: donorIdInt
      },
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
          }
        },
        organization: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      donor_id: donorIdInt,
      count: transactions.length,
      transactions: transactions
    });

  } catch (error) {
    console.error("Error fetching transactions by donor ID:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch transactions",
      details: error.message
    }, { status: 500 });
  }
}
