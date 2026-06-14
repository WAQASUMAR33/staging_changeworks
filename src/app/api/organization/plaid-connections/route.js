import { NextResponse } from 'next/server';
import { getPlaidConfig } from '@/app/lib/payment-mode';
import { prisma } from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { corsHeaders } from '@/app/lib/cors';


function getPlaidBaseUrl(env) {
  switch (env) {
    case 'production': return 'https://production.plaid.com';
    case 'development': return 'https://development.plaid.com';
    default: return 'https://sandbox.plaid.com';
  }
}


export const dynamic = 'force-dynamic';

async function fetchPlaidAccounts(accessToken, plaid) {
  try {
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
      if (errorCode === 'INVALID_ACCESS_TOKEN') return { accounts: [], status: 'INVALID', errorCode };
      if (errorCode === 'ITEM_LOGIN_REQUIRED') return { accounts: [], status: 'LOGIN_REQUIRED', errorCode };
      return { accounts: [], status: 'ERROR', errorCode, error: data?.error_message };
    }

    return { accounts: data.accounts || [], status: 'ACTIVE' };
  } catch (err) {
    return { accounts: [], status: 'ERROR', error: err.message };
  }
}

async function fetchPlaidInstitution(institutionId, plaid) {
  if (!institutionId) return null;
  try {
    const response = await fetch(`${plaid.baseUrl}/institutions/get_by_id`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaid.clientId,
        'PLAID-SECRET': plaid.secretKey,
      },
      body: JSON.stringify({
        client_id: plaid.clientId,
        secret: plaid.secretKey,
        institution_id: institutionId,
        country_codes: ['US'],
        options: { include_optional_metadata: true },
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.institution || null;
  } catch {
    return null;
  }
}

async function checkFundingSource(accessToken, plaid) {
  try {
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
      return { ready: false, ach_count: 0, error: data?.error_message || data?.error_code };
    }

    const achNumbers = data?.numbers?.ach || [];
    return {
      ready: achNumbers.length > 0,
      ach_count: achNumbers.length,
      ach_details: achNumbers.map((n) => ({
        account_id: n.account_id,
        account_last4: n.account?.slice(-4),
        routing: n.routing,
      })),
    };
  } catch {
    return { ready: false, ach_count: 0, error: 'Failed to check auth' };
  }
}

export async function GET(req) {
  const plaid = await getPlaidConfig();
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const organizationId = decoded.id;

    // Debug: count all plaid_connections regardless of org to verify DB access
    const totalCount = await prisma.plaidConnection.count();
    const orgCount = await prisma.plaidConnection.count({ where: { organization_id: organizationId } });

    const connections = await prisma.plaidConnection.findMany({
      where: { organization_id: organizationId },
      include: {
        donor: {
          select: { id: true, name: true, email: true, phone: true, imageUrl: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });

    const enrichedConnections = [];

    await Promise.all(
      connections.map(async (conn) => {
        const accountsData = await fetchPlaidAccounts(conn.access_token, plaid);

        const [institutionData, fundingSource] = await Promise.all([
          fetchPlaidInstitution(conn.institution_id, plaid),
          checkFundingSource(conn.access_token, plaid),
        ]);

        enrichedConnections.push({
          id: conn.id,
          status: accountsData.status,
          institution_name: institutionData?.name || conn.institution_name || null,
          institution_id: conn.institution_id,
          institution_logo: institutionData?.logo || null,
          institution_primary_color: institutionData?.primary_color || null,
          connected_at: conn.created_at,
          updated_at: conn.updated_at,
          donor: conn.donor,
          accounts: accountsData.accounts.map((a) => ({
            account_id: a.account_id,
            name: a.name,
            official_name: a.official_name,
            type: a.type,
            subtype: a.subtype,
            mask: a.mask,
            balances: a.balances,
          })),
          funding_source: fundingSource,
        });
      })
    );

    enrichedConnections.sort((a, b) => new Date(b.connected_at) - new Date(a.connected_at));

    const fundingReadyCount = enrichedConnections.filter((c) => c.funding_source?.ready).length;

    return NextResponse.json({
      success: true,
      connections: enrichedConnections,
      summary: {
        total_donors: enrichedConnections.length,
        funding_ready: fundingReadyCount,
        institutions: new Set(enrichedConnections.map((c) => c.institution_id).filter(Boolean)).size,
      },
      _debug: {
        queried_org_id: organizationId,
        total_plaid_connections_in_db: totalCount,
        connections_for_this_org: orgCount,
      },
    });
  } catch (error) {
    console.error('Error fetching org Plaid connections:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
