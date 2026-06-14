import { NextResponse } from "next/server";
import { getPlaidConfig } from '@/app/lib/payment-mode';
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";
import emailService from "@/app/lib/email-service";
import { corsHeaders } from '@/app/lib/cors';

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

    // Generate mock data
    const mockAccessToken = `access-sandbox-mock-${Date.now()}-${donorId}`;
    const mockItemId = `item-mock-${Date.now()}-${donorId}`;
    const mockAccounts = [
      {
        account_id: `mock-account-1-${Date.now()}`,
        name: 'Mock Checking Account',
        type: 'depository',
        subtype: 'checking',
        mask: '0000',
        official_name: 'Mock Bank Checking Account'
      },
      {
        account_id: `mock-account-2-${Date.now()}`,
        name: 'Mock Savings Account',
        type: 'depository',
        subtype: 'savings',
        mask: '1111',
        official_name: 'Mock Bank Savings Account'
      }
    ];

    // Save mock Plaid connection to database
    // Store organization_id in accounts JSON for now until database migration is complete
    const mockAccountsWithOrgId = mockAccounts.map(account => ({
      ...account,
      organization_id: organization_id,
      is_mock: true
    }));

    const connectionData = {
      donor_id: donorId,
      access_token: mockAccessToken,
      item_id: mockItemId,
      institution_id: 'ins_mock_bank',
      institution_name: 'Mock Bank',
      accounts: JSON.stringify(mockAccountsWithOrgId),
      status: 'ACTIVE',
      created_at: new Date(),
      updated_at: new Date(),
    };

    // Create Plaid connection with proper Prisma relations
    const plaidConnection = await prisma.plaidConnection.create({
      data: {
        donor_id: donorId,
        organization_id: organization_id,
        access_token: mockAccessToken,
        item_id: mockItemId,
        institution_id: 'ins_mock_bank',
        institution_name: 'Mock Bank',
        accounts: JSON.stringify(mockAccounts),
        status: 'ACTIVE',
        donor: {
          connect: { id: donorId }
        },
        organization: {
          connect: { id: organization_id }
        }
      },
    });

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
      message: 'Mock bank account connected successfully',
      connection: {
        id: plaidConnection.id,
        institution_name: plaidConnection.institution_name,
        accounts_count: mockAccounts.length,
        status: plaidConnection.status,
        is_mock: true
      },
    });

  } catch (error) {
    console.error('Error exchanging mock Plaid token:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json(
      { success: false, error: 'Failed to exchange mock token', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
