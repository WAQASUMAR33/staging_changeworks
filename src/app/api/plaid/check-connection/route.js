import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request) {
  try {
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
    return NextResponse.json(
      { success: false, error: 'Failed to check Plaid connection', details: error.message },
      { status: 500 }
    );
  }
}
