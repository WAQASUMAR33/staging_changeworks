import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/verify/error?reason=missing_token', request.url));
  }

  try {
    // Find the token
    const verificationToken = await prisma.verificationToken.findUnique({
      where: { token },
    });

    if (!verificationToken) {
      return NextResponse.redirect(new URL('/verify/error?reason=invalid_or_expired', request.url));
    }

    // Check if expired
    if (new Date() > verificationToken.expires) {
      // Clean up expired token
      await prisma.verificationToken.delete({ where: { token } });
      return NextResponse.redirect(new URL('/verify/error?reason=expired', request.url));
    }

    // Verify user
    // First check if user exists
    const user = await prisma.user.findUnique({
      where: { email: verificationToken.identifier }
    });

    if (!user) {
       return NextResponse.redirect(new URL('/verify/error?reason=user_not_found', request.url));
    }

    // Update user
    await prisma.user.update({
      where: { email: verificationToken.identifier },
      data: { emailVerified: new Date() },
    });

    // Delete token
    await prisma.verificationToken.delete({
      where: { token },
    });

    // Redirect to success page
    return NextResponse.redirect(new URL(`/verify/success?email=${encodeURIComponent(user.email)}`, request.url));

  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.redirect(new URL('/verify/error?reason=server_error', request.url));
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
