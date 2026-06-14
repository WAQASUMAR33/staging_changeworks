import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

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
    const { donor_id } = await request.json();

    if (!donor_id) {
      return NextResponse.json(
        { error: 'donor_id is required in request body' },
        { status: 400 }
      );
    }

    const donorId = parseInt(donor_id);

    if (isNaN(donorId)) {
      return NextResponse.json(
        { error: 'donor_id must be a valid number' },
        { status: 400 }
      );
    }

    console.log(`🔍 Looking for Plaid connection for donor ${donorId}`);

    // Find the Plaid connection(s) for this donor
    const connections = await prisma.plaidConnection.findMany({
      where: {
        donor_id: donorId
      }
    });

    if (!connections || connections.length === 0) {
      console.log(`ℹ️ No Plaid connection found for donor ${donorId}`);
      return NextResponse.json({
        success: true,
        message: 'No Plaid connection found to disconnect',
        deletedCount: 0
      });
    }

    console.log(`✅ Found ${connections.length} Plaid connection(s) for donor ${donorId}`);

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
        donor_id: donorId
      }
    });

    console.log(`✅ Deleted ${deletedConnection.count} Plaid connection(s) from database for donor ${donorId}`);

    // Prepare response
    const response = {
      success: true,
      message: 'Plaid connection disconnected successfully',
      deletedCount: deletedConnection.count,
      donor_id: donorId
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
