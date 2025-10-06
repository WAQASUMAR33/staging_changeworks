import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";

const donationSchema = z.object({
  donor_id: z.number().int().positive(),
  organization_id: z.number().int().positive(),
  amount: z.number().positive(), // dollars
  currency: z.enum(["USD"]).default("USD"),
  method: z.enum(["stripe", "plaid"]),
  status: z.enum(["completed", "pending", "failed"]).default("completed"),
  transaction_id: z.string().optional(),
  receipt_url: z.string().url().optional(),
  description: z.string().optional(),
  stripe_details: z.record(z.any()).optional()
});

export async function POST(request) {
  try {
    const body = await request.json();
    const data = donationSchema.parse(body);

    // Ensure donor and organization exist
    const [donor, organization] = await Promise.all([
      prisma.donor.findUnique({ where: { id: data.donor_id }, select: { id: true } }),
      prisma.organization.findUnique({ where: { id: data.organization_id }, select: { id: true } })
    ]);

    if (!donor) {
      return NextResponse.json({ success: false, error: "Invalid donor_id" }, { status: 400 });
    }
    if (!organization) {
      return NextResponse.json({ success: false, error: "Invalid organization_id" }, { status: 400 });
    }

    // Map to saveTrRecord
    const created = await prisma.saveTrRecord.create({
      data: {
        trx_id: data.transaction_id || `manual_${Date.now()}`,
        trx_date: new Date(),
        trx_amount: data.amount, // stored in dollars
        trx_method: data.method,
        trx_donor_id: data.donor_id,
        trx_organization_id: data.organization_id,
        trx_details: JSON.stringify({
          description: data.description,
          receipt_url: data.receipt_url,
          stripe_details: data.stripe_details
        }),
        pay_status: data.status
      }
    });

    // If completed, increment org balance
    if (data.status === 'completed') {
      await prisma.organization.update({
        where: { id: data.organization_id },
        data: { balance: { increment: data.amount } }
      });
    }

    return NextResponse.json({ success: true, donation: created });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: "Validation error", details: error.errors }, { status: 400 });
    }
    console.error('Donation record error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
