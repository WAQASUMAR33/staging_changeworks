import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

// GET - Get transactions by GHL ID
export async function GET(request, { params }) {
  try {
    const { ghl_id } = await params;

    if (!ghl_id) {
      return NextResponse.json({
        success: false,
        error: "GHL ID is required"
      }, { status: 400 });
    }

    const transactions = await prisma.saveTrRecord.findMany({
      where: {
        trx_ghl_id: ghl_id
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
      ghl_id: ghl_id,
      count: transactions.length,
      transactions: transactions
    });

  } catch (error) {
    console.error("Error fetching transactions by GHL ID:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch transactions",
      details: error.message
    }, { status: 500 });
  }
}
