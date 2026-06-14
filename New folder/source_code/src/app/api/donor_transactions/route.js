import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { z } from "zod";

const transactionSchema = z.object({
  donor_id: z.number().int().positive("Donor ID is required"),
  organization_id: z.number().int().positive("Organization ID is required"),
  status: z.enum(["completed", "pending", "failed"], {
    errorMap: () => ({ message: "Status must be one of: completed, pending, failed" }),
  }),
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().length(3, "Currency must be a 3-letter ISO 4217 code"),
  receipt_url: z.string().url("Invalid URL").optional().or(z.literal("")),
  trnx_id: z.string().min(1, "Transaction ID is required").max(100),
  transaction_type: z.enum(["donation", "refund", "other"], {
    errorMap: () => ({ message: "Transaction type must be one of: donation, refund, other" }),
  }),
  payment_method: z.enum(["credit_card", "paypal", "bank_transfer", "cash"], {
    errorMap: () => ({ message: "Payment method must be one of: credit_card, paypal, bank_transfer, cash" }),
  }),
});

export async function POST(request) {
  try {
    // Verify Prisma client has DonorTransaction model
    if (!prisma.donorTransaction) {
      throw new Error("Prisma DonorTransaction model is not defined. Run 'npx prisma generate'.");
    }

    const body = await request.json();
    const { donor_id, organization_id, status, amount, currency, receipt_url, trnx_id, transaction_type, payment_method } = transactionSchema.parse(body);

    // Verify donor exists
    const donor = await prisma.donor.findUnique({ where: { id: donor_id } });
    if (!donor) {
      return NextResponse.json({ error: "Invalid donor ID" }, { status: 400 });
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({ where: { id: organization_id } });
    if (!organization) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    // Check for duplicate transaction ID
    const existingTransaction = await prisma.donorTransaction.findUnique({ where: { trnx_id } });
    if (existingTransaction) {
      return NextResponse.json({ error: "Transaction ID already exists" }, { status: 400 });
    }

    // Create transaction
    const transaction = await prisma.donorTransaction.create({
      data: {
        donor: { connect: { id: donor_id } },
        organization: { connect: { id: organization_id } },
        status,
        amount,
        currency,
        receipt_url,
        trnx_id,
        transaction_type,
        payment_method,
      },
      include: {
        donor: { select: { id: true, name: true, email: true } },
        organization: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json(
      { message: "Transaction created successfully", transaction },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Transaction creation error:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}



export async function GET(request) {
  try {
    // Verify Prisma client has DonorTransaction model
    if (!prisma.donorTransaction) {
      throw new Error("Prisma DonorTransaction model is not defined. Run 'npx prisma generate'.");
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page');
    const limit = searchParams.get('limit');

    // If pagination params are provided, use them; otherwise return all
    let transactions;
    let totalCount;

    if (page && limit) {
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      [transactions, totalCount] = await Promise.all([
        prisma.donorTransaction.findMany({
          skip,
          take: parseInt(limit, 10),
          select: {
            id: true,
            donor_id: true,
            organization_id: true,
            status: true,
            amount: true,
            currency: true,
            receipt_url: true,
            trnx_id: true,
            transaction_type: true,
            payment_method: true,
            created_at: true,
            updated_at: true,
            donor: { select: { id: true, name: true, email: true } },
            organization: { select: { id: true, name: true } },
          },
          orderBy: { created_at: 'desc' },
        }),
        prisma.donorTransaction.count(),
      ]);
    } else {
      // Return all transactions
      transactions = await prisma.donorTransaction.findMany({
        select: {
          id: true,
          donor_id: true,
          organization_id: true,
          status: true,
          amount: true,
          currency: true,
          receipt_url: true,
          trnx_id: true,
          transaction_type: true,
          payment_method: true,
          created_at: true,
          updated_at: true,
          donor: { select: { id: true, name: true, email: true } },
          organization: { select: { id: true, name: true } },
        },
        orderBy: { created_at: 'desc' },
      });
      totalCount = transactions.length;
    }

    return NextResponse.json({ transactions, totalCount }, { status: 200 });
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch transactions' }, { status: 500 });
  }
}