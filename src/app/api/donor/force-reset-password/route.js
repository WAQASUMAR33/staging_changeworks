import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    if (!decoded.mustResetPassword) {
      return NextResponse.json({ error: 'Password reset not required' }, { status: 400 });
    }

    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.$queryRaw`
      UPDATE donors
      SET password = ${hashedPassword}, must_reset_password = 0, updated_at = ${new Date()}
      WHERE id = ${decoded.id}
    `;

    // Issue a full 7-day token now that reset is complete
    const newToken = jwt.sign(
      { id: decoded.id, email: decoded.email, role: 'DONOR', userType: 'donor' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({ message: 'Password updated successfully', token: newToken });
  } catch (error) {
    console.error('Force reset password error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
