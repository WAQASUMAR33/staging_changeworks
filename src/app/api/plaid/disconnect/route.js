import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

// Plaid configuration
const PLAID_CLIENT_ID = process.env.PLAID_CLIENT_ID;
const PLAID_SECRET_KEY = process.env.PLAID_SECRET_KEY;
const PLAID_ENV = (process.env.NEXT_PUBLIC_PLAID_ENV || 'sandbox').toLowerCase();

function getPlaidBaseUrl(env) {
  switch (env) {
    case 'production':
      return 'https://production.plaid.com';
    case 'development':
      return 'https://development.plaid.com';
    default:
      return 'https://sandbox.plaid.com';
  }
}

export async function POST(request) {
  try {
    // Verify JWT token for authentication
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.split(' ')[1];
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      console.error('JWT verification failed:', jwtError);
      return NextResponse.json(
        { error: 'Invalid or expired token. Please log in again.' },
        { status: 401 }
      );
    }

    const authenticatedDonorId = decoded.id;
    const { donor_id } = await request.json();

    if (!donor_id) {
      return NextResponse.json(
        { error: 'Donor ID is required' },
        { status: 400 }
      );
    }

    // Verify that the authenticated user matches the donor_id
    if (parseInt(donor_id) !== authenticatedDonorId) {
      console.error(`Authorization failed: authenticated user ${authenticatedDonorId} tried to disconnect donor ${donor_id}`);
      return NextResponse.json(
        { error: 'Unauthorized: You can only disconnect your own bank account' },
        { status: 403 }
      );
    }

    console.log(`🔍 Looking for Plaid connection for donor ${donor_id}`);

    // Find the Plaid connection(s) for this donor
    const connections = await prisma.plaidConnection.findMany({
      where: {
        donor_id: parseInt(donor_id)
      }
    });

    if (!connections || connections.length === 0) {
      console.log(`ℹ️ No Plaid connection found for donor ${donor_id}`);
      return NextResponse.json({
        success: true,
        message: 'No Plaid connection found to disconnect',
        deletedCount: 0
      });
    }

    console.log(`✅ Found ${connections.length} Plaid connection(s) for donor ${donor_id}`);

    // Remove each item from Plaid's side
    let plaidRemovalErrors = [];
    for (const connection of connections) {
      try {
        // Call Plaid API to remove the item (invalidates the access token)
        const plaidResponse = await fetch(`${getPlaidBaseUrl(PLAID_ENV)}/item/remove`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            client_id: PLAID_CLIENT_ID,
            secret: PLAID_SECRET_KEY,
            access_token: connection.access_token
          }),
          signal: AbortSignal.timeout(15000) // 15 second timeout
        });

        if (!plaidResponse.ok) {
          const errorData = await plaidResponse.json().catch(() => ({}));
          console.error(`⚠️ Failed to remove item ${connection.item_id} from Plaid:`, errorData);
          plaidRemovalErrors.push({
            item_id: connection.item_id,
            error: errorData
          });
          // Continue to remove from database even if Plaid removal fails
        } else {
          console.log(`✅ Successfully removed item ${connection.item_id} from Plaid`);
        }
      } catch (plaidError) {
        console.error(`⚠️ Error calling Plaid API for item ${connection.item_id}:`, plaidError);
        plaidRemovalErrors.push({
          item_id: connection.item_id,
          error: plaidError.message
        });
        // Continue to remove from database even if Plaid removal fails
      }
    }

    // Delete the Plaid connection(s) from database
    const deletedConnection = await prisma.plaidConnection.deleteMany({
      where: {
        donor_id: parseInt(donor_id)
      }
    });

    console.log(`✅ Deleted ${deletedConnection.count} Plaid connection(s) from database for donor ${donor_id}`);

    // Prepare response
    const response = {
      success: true,
      message: 'Plaid connection disconnected successfully',
      deletedCount: deletedConnection.count
    };

    // Include warnings if there were issues with Plaid removal
    if (plaidRemovalErrors.length > 0) {
      response.warnings = plaidRemovalErrors;
      response.message = 'Plaid connection removed from database. Some items may still be active on Plaid\'s side.';
      console.warn(`⚠️ Plaid removal had ${plaidRemovalErrors.length} error(s):`, plaidRemovalErrors);
    }

    return NextResponse.json(response);

  } catch (error) {
    console.error('❌ Error disconnecting Plaid:', error);
    
    // Handle case where no connection exists
    if (error.code === 'P2025') {
      return NextResponse.json({
        success: true,
        message: 'No Plaid connection found to disconnect',
        deletedCount: 0
      });
    }

    // Handle network/timeout errors
    if (error.name === 'AbortError' || error.message.includes('timeout')) {
      return NextResponse.json(
        { 
          error: 'Request timeout. The connection may have been partially removed. Please try again.',
          details: 'Network timeout while communicating with Plaid API'
        },
        { status: 504 }
      );
    }

    return NextResponse.json(
      { 
        error: 'Failed to disconnect Plaid connection',
        details: error.message 
      },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
