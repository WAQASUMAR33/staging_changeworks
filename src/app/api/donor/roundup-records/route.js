import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { corsHeaders } from '@/app/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    const records = await prisma.saveTrRecord.findMany({
      where: {
        trx_donor_id: donorId,
        trx_method: { in: ['ach', 'card'] },
      },
      orderBy: { trx_date: 'desc' },
      select: {
        id: true,
        trx_date: true,
        trx_amount: true,
        trx_method: true,
        pay_status: true,
        trx_details: true,
        organization: { select: { id: true, name: true } },
      },
    });

    const enriched = records.map(r => {
      let details = null;
      try { details = r.trx_details ? JSON.parse(r.trx_details) : null; } catch { /**/ }
      return {
        id: r.id,
        trx_date: r.trx_date,
        trx_amount: r.trx_amount,
        trx_method: r.trx_method,
        pay_status: r.pay_status,
        organization: r.organization,
        card_label: details?.card_label ?? null,
        start_date: details?.start_date ?? null,
        end_date: details?.end_date ?? null,
        transaction_count: details?.transaction_count ?? null,
      };
    });

    return NextResponse.json({ success: true, records: enriched });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    console.error('roundup-records error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load records' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
