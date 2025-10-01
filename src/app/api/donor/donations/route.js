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
