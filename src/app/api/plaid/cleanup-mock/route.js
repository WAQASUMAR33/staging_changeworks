import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { corsHeaders } from '@/app/lib/cors';

export async function DELETE(req) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    jwt.verify(token, process.env.JWT_SECRET);

    // Delete all connections that have mock/sandbox access tokens
    const result = await prisma.$executeRaw`
      DELETE FROM plaid_connections
      WHERE access_token LIKE 'access-sandbox-%'
         OR institution_id = 'ins_mock_bank'
         OR institution_name = 'Mock Bank'
    `;

    return NextResponse.json({
      success: true,
      deleted: result,
      message: `Deleted ${result} mock connection(s). Donors must reconnect their bank accounts.`,
    });
  } catch (error) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
