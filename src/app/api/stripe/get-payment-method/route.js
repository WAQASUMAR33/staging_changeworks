import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const donorIdParam = searchParams.get('donor_id');
    const orgIdParam   = searchParams.get('organization_id');

    if (!donorIdParam) {
      return NextResponse.json({ success: false, error: 'donor_id is required' }, { status: 400 });
    }

    const donorId = parseInt(donorIdParam);
    if (isNaN(donorId)) {
      return NextResponse.json({ success: false, error: 'donor_id must be a number' }, { status: 400 });
    }

    let rows;

    if (orgIdParam) {
      const orgId = parseInt(orgIdParam);
      rows = await prisma.$queryRaw`
        SELECT
          id, organization_id, stripe_customer_id, stripe_payment_method_id,
          label, card_brand, card_last4, card_exp_month, card_exp_year,
          is_default, status, created_at
        FROM donor_payment_methods
        WHERE donor_id       = ${donorId}
          AND organization_id = ${orgId}
          AND status         = 'active'
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      `;
    } else {
      rows = await prisma.$queryRaw`
        SELECT
          id, organization_id, stripe_customer_id, stripe_payment_method_id,
          label, card_brand, card_last4, card_exp_month, card_exp_year,
          is_default, status, created_at
        FROM donor_payment_methods
        WHERE donor_id = ${donorId}
          AND status   = 'active'
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      `;
    }

    const paymentMethod = rows[0] ?? null;

    return NextResponse.json({
      success:            true,
      has_payment_method: paymentMethod !== null,
      payment_method:     paymentMethod,
    });

  } catch (error) {
    console.error('Error fetching payment method:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
