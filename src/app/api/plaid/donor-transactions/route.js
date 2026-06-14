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

async function fetchPlaidAccounts(accessToken) {
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
      return { accounts: [], status: 'ERROR', error: data?.error_message };
    }
    return { accounts: data.accounts || [], status: 'ACTIVE' };
  } catch (err) {
    return { accounts: [], status: 'ERROR', error: err.message };
  }
}

async function fetchPlaidInstitution(institutionId) {
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

async function fetchPlaidTransactions(accessToken, startDate, endDate) {
  try {
    const response = await fetch(`${plaid.baseUrl}/transactions/get`, {
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
        start_date: startDate,
        end_date: endDate,
        options: { count: 100, offset: 0 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errData = await response.json();
      return { transactions: [], total_transactions: 0, error: errData?.error_message || 'Plaid API error' };
    }
    const data = await response.json();
    return { transactions: data.transactions || [], total_transactions: data.total_transactions || 0 };
  } catch (err) {
    return { transactions: [], total_transactions: 0, error: err.message };
  }
}

export async function GET(req) {
  const plaid = await getPlaidConfig();
  try {
    // Verify donor JWT
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

    const donorId = decoded.id;

    const { searchParams } = new URL(req.url);
    const today = new Date();
    const defaultStart = new Date(today);
    defaultStart.setDate(today.getDate() - 30);

    const startDate = searchParams.get('start_date') || defaultStart.toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || today.toISOString().split('T')[0];

    // Fetch only this donor's Plaid connections
    const connections = await prisma.plaidConnection.findMany({
      where: { donor_id: donorId },
      orderBy: { created_at: 'desc' },
    });

    if (connections.length === 0) {
      return NextResponse.json({
        success: true,
        connections: [],
        summary: {
          total_connections: 0,
          total_transactions: 0,
          start_date: startDate,
          end_date: endDate,
        },
      });
    }

    const validConnections = [];
    const invalidIds = [];

    await Promise.all(
      connections.map(async (conn) => {
        const accountsData = await fetchPlaidAccounts(conn.access_token);

        if (accountsData.status === 'INVALID') {
          invalidIds.push(conn.id);
          return;
        }

        const [institutionData, plaidTransactions] = await Promise.all([
          fetchPlaidInstitution(conn.institution_id),
          fetchPlaidTransactions(conn.access_token, startDate, endDate),
        ]);

        validConnections.push({
          id: conn.id,
          status: accountsData.status,
          institution_name: institutionData?.name || conn.institution_name || null,
          institution_id: conn.institution_id,
          institution_logo: institutionData?.logo || null,
          institution_primary_color: institutionData?.primary_color || null,
          connected_at: conn.created_at,
          accounts: accountsData.accounts.map((a) => ({
            account_id: a.account_id,
            name: a.name,
            official_name: a.official_name,
            type: a.type,
            subtype: a.subtype,
            mask: a.mask,
            balances: a.balances,
          })),
          transactions: plaidTransactions.transactions,
          total_transactions: plaidTransactions.total_transactions,
          transactions_error: plaidTransactions.error || null,
        });
      })
    );

    // Auto-delete invalid (mock/fake) connections
    if (invalidIds.length > 0) {
      await prisma.plaidConnection.deleteMany({ where: { id: { in: invalidIds } } });
    }

    validConnections.sort((a, b) => new Date(b.connected_at) - new Date(a.connected_at));

    const totalTransactions = validConnections.reduce((sum, c) => sum + (c.total_transactions || 0), 0);

    return NextResponse.json({
      success: true,
      connections: validConnections,
      summary: {
        total_connections: validConnections.length,
        total_transactions: totalTransactions,
        start_date: startDate,
        end_date: endDate,
      },
    });
  } catch (error) {
    console.error('Error fetching donor Plaid transactions:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
