import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import emailService from '@/app/lib/email-service';
import { corsHeaders } from '@/app/lib/cors';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Check if user exists (check both User and Donor tables)
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Fetch donor with their organization (also check subscriptions as fallback)
    const donor = await prisma.donor.findUnique({
      where: { email: email.toLowerCase() },
      include: {
        organization: true,
        subscriptions: {
          include: {
            organization: true
          },
          take: 1,
          orderBy: { created_at: 'desc' }
        }
      }
    });

    if (!user && !donor) {
      return NextResponse.json(
        { error: 'No account found with this email address' },
        { status: 404 }
      );
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);

    // Set expiration (1 hour from now)
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    // Store reset token
    await prisma.passwordResetToken.create({
      data: {
        identifier: email.toLowerCase(),
        token: hashedToken,
        expires: expires
      }
    });

    // Create reset URL — admin users get the admin reset page, donors get the standard one
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
    const resetPath = user ? '/changeworksadmin/reset-password' : '/reset-password';
    const resetUrl = `${baseUrl}${resetPath}?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Check if email configuration is available
    const hasEmailConfig = process.env.EMAIL_SERVER_HOST &&
                          process.env.EMAIL_SERVER_PORT &&
                          process.env.EMAIL_SERVER_USER &&
                          process.env.EMAIL_SERVER_PASSWORD &&
                          process.env.EMAIL_FROM;

    if (hasEmailConfig) {
      try {
        if (donor) {
          const organization = donor.organization
            || donor.subscriptions?.[0]?.organization
            || null;
          // Use email service so org name appears as the sender header
          await emailService.sendPasswordResetEmail({
            donor: { name: donor.name, email: donor.email },
            resetToken,
            resetLink: resetUrl,
            organization,
          });
        } else {
          // Admin password reset email with ChangeWorks branding
          await emailService.sendAdminPasswordResetEmail({
            email,
            name: user.name || 'Admin',
            resetLink: resetUrl,
          });
        }

        return NextResponse.json({
          message: 'Password reset link sent to your email'
        });

      } catch (emailError) {
        console.error('Email sending error:', emailError);
        return NextResponse.json({
          message: 'Password reset link generated (email sending failed)',
          resetUrl: resetUrl,
          note: 'Please configure email settings in your .env file'
        });
      }
    } else {
      console.log('No email configuration found. Returning reset URL for development.');
      return NextResponse.json({
        message: 'Password reset link generated',
        resetUrl: resetUrl,
        note: 'Please configure email settings in your .env file to send emails automatically'
      });
    }

  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
