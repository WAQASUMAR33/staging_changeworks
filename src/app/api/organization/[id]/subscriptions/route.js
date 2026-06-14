import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { corsHeaders } from '@/app/lib/cors';

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    const subscriptions = await prisma.subscription.findMany({
      where: {
        organization_id: parsedId,
      },
      include: {
        donor: {
          select: {
            name: true,
            email: true,
            imageUrl: true,
          },
        },
        package: {
          select: {
            name: true,
            price: true,
            currency: true,
            interval: true,
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
    });

    return NextResponse.json({ subscriptions }, { status: 200 });
  } catch (error) {
    console.error("Error fetching subscriptions:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
