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

    const connections = await prisma.plaidConnection.findMany({
      where: { donor_id: donorId, status: { not: 'INVALID' } },
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        institution_id: true,
        institution_name: true,
        accounts: true,
        status: true,
        created_at: true,
        organization: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ success: true, connections });
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    console.error('bank-connections error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load connections' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
