import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";
import { corsHeaders } from '@/app/lib/cors';

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

    // Get subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        donor_id: donorId
      },
      include: {
        organization: {
          select: { id: true, name: true, imageUrl: true }
        },
        package: {
          select: { id: true, name: true, description: true }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    // Format subscriptions
    const formattedSubscriptions = subscriptions.map(subscription => ({
      id: subscription.id,
      amount: subscription.amount,
      status: subscription.status,
      interval: subscription.interval || 'monthly',
      description: subscription.package?.name || `Donation to ${subscription.organization?.name}`,
      createdAt: subscription.created_at.toISOString(),
      nextPaymentDate: subscription.current_period_end?.toISOString(),
      organization: subscription.organization,
      package: subscription.package
    }));

    return NextResponse.json({
      success: true,
      subscriptions: formattedSubscriptions
    });

  } catch (error) {
    console.error("Subscriptions fetch error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
