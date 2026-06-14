import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();
    const { webhook_type, webhook_code, item_id, error } = body;

    console.log('Plaid webhook received:', { webhook_type, webhook_code, item_id });

    // Handle different webhook types
    switch (webhook_type) {
      case 'ITEM':
        await handleItemWebhook(webhook_code, item_id, error);
        break;
      case 'TRANSACTIONS':
        await handleTransactionsWebhook(webhook_code, item_id, error);
        break;
      case 'AUTH':
        await handleAuthWebhook(webhook_code, item_id, error);
        break;
      default:
        console.log('Unhandled webhook type:', webhook_type);
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Error processing Plaid webhook:', error);
    return NextResponse.json(
      { success: false, error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleItemWebhook(webhook_code, item_id, error) {
  try {
    const connection = await prisma.plaidConnection.findFirst({
      where: { item_id: item_id },
    });

    if (!connection) {
      console.log('No connection found for item_id:', item_id);
      return;
    }

    switch (webhook_code) {
      case 'ERROR':
        await prisma.plaidConnection.update({
          where: { id: connection.id },
          data: {
            status: 'ERROR',
            error_message: error?.error_message || 'Unknown error',
            updated_at: new Date(),
          },
        });
        break;
      case 'NEW_ACCOUNTS_AVAILABLE':
        // Handle new accounts available
        console.log('New accounts available for item:', item_id);
        break;
      case 'PENDING_EXPIRATION':
        // Handle pending expiration
        console.log('Access token expiring for item:', item_id);
        break;
      case 'USER_PERMISSION_REVOKED':
        await prisma.plaidConnection.update({
          where: { id: connection.id },
          data: {
            status: 'REVOKED',
            updated_at: new Date(),
          },
        });
        break;
      case 'WEBHOOK_UPDATE_ACKNOWLEDGED':
        // Handle webhook update acknowledged
        console.log('Webhook update acknowledged for item:', item_id);
        break;
    }
  } catch (error) {
    console.error('Error handling item webhook:', error);
  }
}

async function handleTransactionsWebhook(webhook_code, item_id, error) {
  try {
    const connection = await prisma.plaidConnection.findFirst({
      where: { item_id: item_id },
    });

    if (!connection) {
      console.log('No connection found for item_id:', item_id);
      return;
    }

    switch (webhook_code) {
      case 'INITIAL_UPDATE':
        console.log('Initial transactions update for item:', item_id);
        break;
      case 'HISTORICAL_UPDATE':
        console.log('Historical transactions update for item:', item_id);
        break;
      case 'DEFAULT_UPDATE':
        console.log('Default transactions update for item:', item_id);
        break;
      case 'TRANSACTIONS_REMOVED':
        console.log('Transactions removed for item:', item_id);
        break;
    }
  } catch (error) {
    console.error('Error handling transactions webhook:', error);
  }
}

async function handleAuthWebhook(webhook_code, item_id, error) {
  try {
    const connection = await prisma.plaidConnection.findFirst({
      where: { item_id: item_id },
    });

    if (!connection) {
      console.log('No connection found for item_id:', item_id);
      return;
    }

    switch (webhook_code) {
      case 'AUTOMATICALLY_VERIFIED':
        console.log('Account automatically verified for item:', item_id);
        break;
      case 'VERIFICATION_EXPIRED':
        console.log('Verification expired for item:', item_id);
        break;
    }
  } catch (error) {
    console.error('Error handling auth webhook:', error);
  }
}
