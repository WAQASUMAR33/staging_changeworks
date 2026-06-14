import { NextResponse } from 'next/server';
import { createStripeClient } from '@/app/lib/payment-mode';
import { prisma } from '../../../lib/prisma';
import { verifyAdminToken } from '../../../lib/admin-auth';
import { corsHeaders } from '@/app/lib/cors';

export const dynamic = 'force-dynamic';


export async function GET(req) {
  try {
    const stripe = await createStripeClient();
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = verifyAdminToken(authHeader.substring(7));
    if (!decoded) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const orgId = parseInt(searchParams.get('org_id'));
    if (!orgId || isNaN(orgId)) {
      return NextResponse.json({ success: false, error: 'org_id is required' }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, stripeAccountId: true },
    });

    if (!org) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    if (!org.stripeAccountId) {
      return NextResponse.json({
        success: true,
        org_id: orgId,
        stripe: { linked: false },
      });
    }

    const account = await stripe.accounts.retrieve(org.stripeAccountId.trim());

    const achCapability = account.capabilities?.us_bank_account_ach_payments;

    return NextResponse.json({
      success: true,
      org_id: orgId,
      stripe: {
        linked: true,
        account_id: account.id,
        charges_enabled: account.charges_enabled,
        payouts_enabled: account.payouts_enabled,
        ready: account.charges_enabled && account.payouts_enabled,
        requirements_due: account.requirements?.currently_due?.length || 0,
        ach_capability: achCapability || 'inactive', // 'active' | 'pending' | 'inactive'
        ach_ready: achCapability === 'active',
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
