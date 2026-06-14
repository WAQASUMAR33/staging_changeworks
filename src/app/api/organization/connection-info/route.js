export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = parseInt(searchParams.get('organizationId'));

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: {
        id: true,
        ghlId: true,
        stripeAccountId: true,
        ghlAccounts: {
          select: { ghl_location_id: true },
          where: { status: 'active' },
          take: 1,
          orderBy: { created_at: 'desc' },
        },
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    const ghlLocationId = org.ghlAccounts?.[0]?.ghl_location_id || org.ghlId || null;

    // Active connection from ghlStripeConnection table
    let stripeAccountId = null;
    if (ghlLocationId) {
      const conn = await prisma.ghlStripeConnection.findUnique({ where: { locationId: ghlLocationId } });
      stripeAccountId = conn?.stripeAccountId || null;
    }

    return NextResponse.json({
      success: true,
      stripeAccountId,
      orgStripeAccountId: org.stripeAccountId || null,
      ghlLocationId,
    });
  } catch (error) {
    console.error('Error fetching connection info:', error);
    return NextResponse.json({ error: 'Failed to fetch connection info' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
