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

    // Get subscriptions
    const subscriptions = await prisma.subscription.findMany({
      where: {
        donorId: donorId
      },
      include: {
        organization: {
          select: { id: true, name: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Format subscriptions
    const formattedSubscriptions = subscriptions.map(subscription => ({
      id: subscription.id,
      amount: subscription.amount,
      status: subscription.status,
      interval: subscription.interval || 'monthly',
      description: subscription.description || `Recurring donation to ${subscription.organization?.name || 'Unknown Organization'}`,
      createdAt: subscription.createdAt.toISOString(),
      nextPaymentDate: subscription.nextPaymentDate?.toISOString(),
      organization: subscription.organization
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
