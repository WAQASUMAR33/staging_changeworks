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

import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.substring(7);
    
    // Verify JWT token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    // Get donor information
    const donor = await prisma.donor.findUnique({
      where: { id: donorId }
    });

    if (!donor) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    // Get donations with pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page')) || 1;
    const limit = parseInt(searchParams.get('limit')) || 20;
    const skip = (page - 1) * limit;

    const donations = await prisma.donorTransaction.findMany({
      where: {
        donor_id: donorId
      },
      include: {
        organization: {
          select: { id: true, name: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      skip,
      take: limit
    });

    // Get total count for pagination
    const totalCount = await prisma.donorTransaction.count({
      where: {
        donor_id: donorId
      }
    });

    // Format donations
    const formattedDonations = donations.map(donation => ({
      id: donation.id,
      amount: donation.amount,
      status: donation.status,
      description: `Donation to ${donation.organization?.name || 'Unknown Organization'}`,
      createdAt: donation.created_at.toISOString(),
      organization: donation.organization,
      transaction_type: donation.transaction_type,
      payment_method: donation.payment_method,
      receipt_url: donation.receipt_url,
      trnx_id: donation.trnx_id
    }));

    return NextResponse.json({
      success: true,
      donations: formattedDonations,
      pagination: {
        page,
        limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error("Donations fetch error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
