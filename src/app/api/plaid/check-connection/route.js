import { NextResponse } from "next/server";
import { createStripeClient, getPlaidConfig } from '@/app/lib/payment-mode';
import { prisma } from "@/app/lib/prisma";
import { corsHeaders } from '@/app/lib/cors';

export const dynamic = 'force-dynamic';

async function verifyPlaidConnection(accessToken) {
  const plaid = await getPlaidConfig();
  try {
    const stripe = await createStripeClient();
    const response = await fetch(`${plaid.baseUrl}/accounts/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaid.clientId,
        'PLAID-SECRET': plaid.secretKey,
      },
      body: JSON.stringify({
        client_id: plaid.clientId,
        secret: plaid.secretKey,
        access_token: accessToken,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorCode = data?.error_code;
      if (errorCode === 'INVALID_ACCESS_TOKEN') return { valid: false, status: 'INVALID' };
      if (errorCode === 'ITEM_LOGIN_REQUIRED') return { valid: true, status: 'LOGIN_REQUIRED' };
      return { valid: false, status: 'ERROR' };
    }

    return { valid: true, status: 'ACTIVE', accounts: data.accounts || [] };
  } catch {
    return { valid: false, status: 'ERROR' };
  }
}

// Check if ACH routing numbers are available (confirms funding source is ready)
async function checkFundingSource(accessToken) {
  const plaid = await getPlaidConfig();
  try {
    const stripe = await createStripeClient();
    const response = await fetch(`${plaid.baseUrl}/auth/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaid.clientId,
        'PLAID-SECRET': plaid.secretKey,
      },
      body: JSON.stringify({
        client_id: plaid.clientId,
        secret: plaid.secretKey,
        access_token: accessToken,
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await response.json();

    if (!response.ok) {
      return { funding_source_ready: false, ach_accounts: 0, error: data?.error_message || data?.error_code };
    }

    const achNumbers = data?.numbers?.ach || [];
    return {
      funding_source_ready: achNumbers.length > 0,
      ach_accounts: achNumbers.length,
      // Only expose last 4 of account numbers for display
      ach_details: achNumbers.map(n => ({
        account_id: n.account_id,
        account_last4: n.account?.slice(-4),
        routing: n.routing,
      })),
    };
  } catch {
    return { funding_source_ready: false, ach_accounts: 0, error: 'Failed to check auth' };
  }
}

export async function GET(request) {
  try {
    const stripe = await createStripeClient();
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

    // Fetch all connections from DB for this donor (include org Stripe account)
    const dbConnections = await prisma.plaidConnection.findMany({
      where: { donor_id: donorId },
      select: {
        id: true,
        access_token: true,
        institution_name: true,
        institution_id: true,
        accounts: true,
        created_at: true,
        organization: { select: { id: true, name: true, stripeAccountId: true } },
      },
      orderBy: { created_at: 'desc' },
    });

    const validConnections = [];
    const invalidIds = [];

    // Verify each connection live against Plaid
    await Promise.all(
      dbConnections.map(async (conn) => {
        const [result, fundingSource] = await Promise.all([
          verifyPlaidConnection(conn.access_token),
          checkFundingSource(conn.access_token),
        ]);

        if (result.status === 'INVALID') {
          // Fake/mock token — mark for deletion
          invalidIds.push(conn.id);
          return;
        }

        // Check if the org's Stripe sub-account is connected and charges enabled
        let stripeStatus = { linked: false, charges_enabled: false, account_id: null };
        const stripeAccountId = conn.organization?.stripeAccountId?.trim();
        if (stripeAccountId) {
          try {
            const stripeAccount = await stripe.accounts.retrieve(stripeAccountId);
            stripeStatus = {
              linked:          true,
              account_id:      stripeAccount.id,
              charges_enabled: stripeAccount.charges_enabled,
              payouts_enabled: stripeAccount.payouts_enabled,
              ready:           stripeAccount.charges_enabled && stripeAccount.payouts_enabled,
            };
          } catch (stripeErr) {
            stripeStatus = { linked: false, charges_enabled: false, error: stripeErr.message };
          }
        }

        const readyToCharge = result.status === 'ACTIVE' && stripeStatus.ready === true;

        // Human-readable connection message
        let connectionMessage;
        if (result.status !== 'ACTIVE') {
          connectionMessage = '⚠️ Bank connection requires re-authentication';
        } else if (!stripeAccountId) {
          connectionMessage = '❌ Organization has no Stripe account connected';
        } else if (stripeStatus.error) {
          connectionMessage = `❌ Failed to connect with Stripe: ${stripeStatus.error}`;
        } else if (!stripeStatus.charges_enabled) {
          connectionMessage = '⚠️ Stripe account connected but charges not yet enabled — organization must complete Stripe onboarding';
        } else if (!stripeStatus.payouts_enabled) {
          connectionMessage = '⚠️ Stripe account connected but payouts not yet enabled';
        } else {
          connectionMessage = '✅ Plaid bank connected and linked with Stripe — ready to charge';
        }

        validConnections.push({
          id: conn.id,
          institution_name: conn.institution_name,
          institution_id:   conn.institution_id,
          status:           result.status,
          accounts:         conn.accounts,
          created_at:       conn.created_at,
          organization:     conn.organization,
          stripe:           stripeStatus,
          funding_source:   fundingSource,
          ready_to_charge:  readyToCharge,
          message:          connectionMessage,
        });
      })
    );

    // Auto-delete invalid (mock) connections
    if (invalidIds.length > 0) {
      await prisma.plaidConnection.deleteMany({
        where: { id: { in: invalidIds } },
      });
    }

    const isConnected    = validConnections.some((c) => c.status === 'ACTIVE');
    const readyToCharge  = validConnections.some((c) => c.ready_to_charge === true);

    // Top-level summary message
    let summaryMessage;
    if (!isConnected) {
      summaryMessage = '❌ No active bank connection found';
    } else if (!readyToCharge) {
      summaryMessage = '⚠️ Bank connected via Plaid but Stripe link is not ready';
    } else {
      summaryMessage = '✅ Plaid connected and linked with Stripe — round-up charges can be collected';
    }

    return NextResponse.json({
      success:          true,
      is_connected:     isConnected,
      ready_to_charge:  readyToCharge,
      message:          summaryMessage,
      connections:      validConnections,
      connection_count: validConnections.length,
      donor_id:         donorId,
    });
  } catch (error) {
    console.error('Error checking Plaid connection:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check Plaid connection', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
