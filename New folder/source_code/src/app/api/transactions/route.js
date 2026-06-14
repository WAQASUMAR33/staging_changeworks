import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { z } from "zod";

// Validation schema for transaction
const transactionSchema = z.object({
  trx_id: z.string().min(1, "Transaction ID is required"),
  trx_date: z.string().datetime("Invalid date format"),
  trx_amount: z.number().positive("Amount must be positive"),
  trx_method: z.enum(["stripe", "plaid"], "Payment method must be either 'stripe' or 'plaid'"),
  trx_recipt_url: z.string().url().optional().or(z.literal("")),
  trx_donor_id: z.number().int().positive("Donor ID is required"),
  trx_ghl_id: z.string().optional(),
  trx_details: z.string().optional(),
  trx_organization_id: z.number().int().positive("Organization ID is required"),
  pay_status: z.enum(["pending", "completed", "failed", "cancelled"]).default("pending"),
});

// GET - Get all transactions or filter by query parameters
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const trx_ghl_id = searchParams.get('trx_ghl_id');
    const donor_id = searchParams.get('donor_id');
    const organization_id = searchParams.get('organization_id');

    let whereClause = {};

    // Filter by GHL ID
    if (trx_ghl_id) {
      whereClause.trx_ghl_id = trx_ghl_id;
    }

    // Filter by donor ID
    if (donor_id) {
      whereClause.trx_donor_id = parseInt(donor_id);
    }

    // Filter by organization ID
    if (organization_id) {
      whereClause.trx_organization_id = parseInt(organization_id);
    }

    const transactions = await prisma.saveTrRecord.findMany({
      where: whereClause,
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
      count: transactions.length,
      transactions: transactions
    });

  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch transactions",
      details: error.message
    }, { status: 500 });
  }
}

// POST - Create new transaction
export async function POST(request) {
  try {
    const body = await request.json();
    const input = transactionSchema.parse(body);

    // Check if transaction ID already exists
    const existingTransaction = await prisma.saveTrRecord.findUnique({
      where: { trx_id: input.trx_id }
    });

    if (existingTransaction) {
      return NextResponse.json({
        success: false,
        error: "Transaction ID already exists"
      }, { status: 400 });
    }

    // Verify donor exists
    const donor = await prisma.donor.findUnique({
      where: { id: input.trx_donor_id }
    });

    if (!donor) {
      return NextResponse.json({
        success: false,
        error: "Donor not found"
      }, { status: 404 });
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: input.trx_organization_id }
    });

    if (!organization) {
      return NextResponse.json({
        success: false,
        error: "Organization not found"
      }, { status: 404 });
    }

    // Create transaction
    const transaction = await prisma.saveTrRecord.create({
      data: {
        trx_id: input.trx_id,
        trx_date: new Date(input.trx_date),
        trx_amount: input.trx_amount,
        trx_method: input.trx_method,
        trx_recipt_url: input.trx_recipt_url || null,
        trx_donor_id: input.trx_donor_id,
        trx_ghl_id: input.trx_ghl_id || null,
        trx_details: input.trx_details || null,
        trx_organization_id: input.trx_organization_id,
        pay_status: input.pay_status,
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
      }
    });

    return NextResponse.json({
      success: true,
      message: "Transaction created successfully",
      transaction: transaction
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: "Validation error",
        details: error.errors
      }, { status: 400 });
    }

    console.error("Error creating transaction:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to create transaction",
      details: error.message
    }, { status: 500 });
  }
}
