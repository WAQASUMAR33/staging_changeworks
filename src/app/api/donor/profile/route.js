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

    // Workaround for broken Prisma Client
    const donors = await prisma.$queryRaw`SELECT * FROM donors WHERE id = ${donorId}`;
    const donorRaw = donors[0];

    if (!donorRaw) {
      return NextResponse.json({ error: "Donor not found" }, { status: 404 });
    }

    let organization = null;
    if (donorRaw.organization_id) {
        organization = await prisma.organization.findUnique({
            where: { id: donorRaw.organization_id },
            select: { id: true, name: true }
        });
    }

    const donor = {
        ...donorRaw,
        organization
    };

    // Remove sensitive information
    const { password, ...donorWithoutPassword } = donor;

    return NextResponse.json({
      success: true,
      donor: donorWithoutPassword
    });

  } catch (error) {
    console.error("Profile fetch error:", error);
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
