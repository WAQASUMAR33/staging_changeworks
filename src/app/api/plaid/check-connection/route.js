import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

export async function GET(request) {
  try {
    // Verify JWT token for authentication
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return NextResponse.json({ success: false, error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get donor_id from query parameters
    const { searchParams } = new URL(request.url);
    const donorIdParam = searchParams.get('donor_id');

    if (!donorIdParam) {
      return NextResponse.json(
        { success: false, error: 'donor_id query parameter is required' },
        { status: 400 }
      );
    }

    const donorId = parseInt(donorIdParam);

    if (isNaN(donorId)) {
      return NextResponse.json(
        { success: false, error: 'donor_id must be a valid number' },
        { status: 400 }
      );
    }

    console.log(`🔍 Checking Plaid connection for donor ${donorId}`);

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
    
    console.log(`✅ Found ${plaidConnections.length} active Plaid connection(s) for donor ${donorId}`);
    
    return NextResponse.json({
      success: true,
      is_connected: isConnected,
      connections: plaidConnections,
      connection_count: plaidConnections.length,
      donor_id: donorId
    });

  } catch (error) {
    console.error('❌ Error checking Plaid connection:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to check Plaid connection', details: error.message },
      { status: 500 }
    );
  }
}
