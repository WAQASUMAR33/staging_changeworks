import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    // Verify JWT token
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    // Check if donor has any active Plaid connections
    const plaidConnections = await prisma.plaidConnection.findMany({
      where: {
        donor_id: donorId,
        status: 'ACTIVE'
      },
      select: {
        id: true,
        institution_name: true,
        institution_id: true,
        accounts: true,
        created_at: true,
        organization: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    const isConnected = plaidConnections.length > 0;
    
    return NextResponse.json({
      success: true,
      is_connected: isConnected,
      connections: plaidConnections,
      connection_count: plaidConnections.length
    });

  } catch (error) {
    console.error('Error checking Plaid connection:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to check Plaid connection', details: error.message },
      { status: 500 }
    );
  }
}
