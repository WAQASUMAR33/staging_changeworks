import { NextResponse } from "next/server";
import { getPlaidConfig } from '@/app/lib/payment-mode';
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";
import { emailService } from "@/app/lib/email-service";
import { corsHeaders } from '@/app/lib/cors';
// Plaid configuration

function getPlaidBaseUrl(env) {
  switch (env) {
    case 'production': return 'https://production.plaid.com';
    case 'development': return 'https://development.plaid.com';
    default: return 'https://sandbox.plaid.com';
  }
}


export async function POST(request) {
  const plaid = await getPlaidConfig();
  try {
    // Verify JWT token
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    const { public_token, metadata, organization_id } = await request.json();

    if (!public_token) {
      return NextResponse.json(
        { success: false, error: 'Public token is required' },
        { status: 400 }
      );
    }

    // Exchange public token for access token
    const exchangeResponse = await fetch(`${plaid.baseUrl}/item/public_token/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaid.clientId,
        'PLAID-SECRET': plaid.secretKey,
      },
      body: JSON.stringify({
        client_id: plaid.clientId,
        secret: plaid.secretKey,
        public_token: public_token,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const exchangeData = await exchangeResponse.json();
    console.log('Plaid Exchange Response:', JSON.stringify(exchangeData, null, 2));

    if (!exchangeResponse.ok) {
      console.error('Plaid token exchange failed:', exchangeData);
      return NextResponse.json(
        { success: false, error: 'Failed to exchange token', details: exchangeData },
        { status: 500 }
      );
    }

    const { access_token, item_id } = exchangeData;

    // Get account information
    const accountsResponse = await fetch(`${plaid.baseUrl}/accounts/get`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'PLAID-CLIENT-ID': plaid.clientId,
        'PLAID-SECRET': plaid.secretKey,
      },
      body: JSON.stringify({
        client_id: plaid.clientId,
        secret: plaid.secretKey,
        access_token: access_token,
      }),
      signal: AbortSignal.timeout(30000), // 30 second timeout
    });

    const accountsData = await accountsResponse.json();
    console.log('Plaid Accounts Response:', JSON.stringify(accountsData, null, 2));

    if (!accountsResponse.ok) {
      console.error('Plaid accounts get failed:', accountsData);
      return NextResponse.json(
        { success: false, error: 'Failed to get account information', details: accountsData },
        { status: 500 }
      );
    }

    const { accounts } = accountsData;

    // Save Plaid connection to database
    // Store organization_id in accounts JSON for now until database migration is complete
    const accountsWithOrgId = accounts.map(account => ({
      ...account,
      organization_id: organization_id
    }));

    const connectionData = {
      donor_id: donorId,
      access_token: access_token,
      item_id: item_id,
      institution_id: metadata.institution?.institution_id || null,
      institution_name: metadata.institution?.name || null,
      accounts: JSON.stringify(accountsWithOrgId),
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Create Plaid connection with proper Prisma relations
    // Workaround for broken Prisma Client
    const createdConnections = await prisma.$queryRaw`
      INSERT INTO plaid_connections (
        donor_id, 
        organization_id, 
        access_token, 
        item_id, 
        institution_id, 
        institution_name, 
        accounts, 
        status, 
        created_at, 
        updated_at
      ) VALUES (
        ${donorId}, 
        ${organization_id}, 
        ${access_token}, 
        ${item_id}, 
        ${metadata.institution?.institution_id || null}, 
        ${metadata.institution?.name || null}, 
        ${JSON.stringify(accountsWithOrgId)}, 
        'ACTIVE', 
        ${new Date()}, 
        ${new Date()}
      )
    `;

    // Fetch the created record since INSERT doesn't return it in MySQL
    const plaidConnections = await prisma.$queryRaw`
      SELECT * FROM plaid_connections 
      WHERE donor_id = ${donorId} AND item_id = ${item_id} 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const plaidConnection = plaidConnections[0];

    // Send Round Up Welcome Email
    try {
      // Fetch donor and organization details
      const donor = await prisma.donor.findUnique({ where: { id: donorId } });
      const organization = await prisma.organization.findUnique({ where: { id: organization_id } });

      if (donor && organization) {
        let appBase = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
        if (!/^https?:\/\//i.test(appBase)) appBase = `https://${appBase}`;
        const dashboardLink = `${appBase}/donor/login`;
        
        console.log('📧 Sending Welcome Round-Up email to:', donor.email);
        await emailService.sendWelcomeEmail({
          donor: {
            name: donor.name,
            email: donor.email
          },
          organization,
          dashboardLink
        });
      }
    } catch (emailError) {
      console.error('❌ Failed to send Round Up Welcome email:', emailError);
      // Don't fail the request if email fails
    }

    return NextResponse.json({
      success: true,
      message: 'Bank account connected successfully',
      connection: {
        id: plaidConnection.id,
        institution_name: plaidConnection.institution_name,
        accounts_count: accounts.length,
        status: plaidConnection.status,
      },
      // Debug info to verify Plaid response
      debug: {
        exchange_response: exchangeData,
        accounts_response: accountsData
      }
    });

  } catch (error) {
    console.error('Error exchanging Plaid token:', error);
    console.error('Error details:', {
      name: error.name,
      message: error.message,
      stack: error.stack
    });
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    
    // Handle network connectivity issues
    if (error.code === 'UND_ERR_CONNECT_TIMEOUT' || error.message.includes('timeout') || error.message.includes('fetch failed')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Network connection timeout. Please check your internet connection and try again.',
          details: 'Unable to connect to Plaid API. This may be due to network issues or firewall restrictions.',
          errorCode: 'NETWORK_TIMEOUT'
        },
        { status: 503 }
      );
    }
    
    // Handle other network errors
    if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Unable to connect to Plaid service. Please try again later.',
          details: 'DNS resolution or connection refused error.',
          errorCode: 'NETWORK_ERROR'
        },
        { status: 503 }
      );
    }
    
    // Check for specific database errors
    if (error.message.includes('Unknown argument') || error.message.includes('organization_id')) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Database schema error: organization_id field missing. Please run the migration script.',
          details: error.message 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'Failed to exchange token', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
