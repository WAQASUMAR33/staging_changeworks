import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { emailService } from "../../../lib/email-service";
import { corsHeaders } from '@/app/lib/cors';

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    console.log('🔍 Organization password reset requested for:', email);

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        firstName: true,
        lastName: true,
        title: true
      }
    });

    if (!organization) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: "If an organization account with that email exists, a password reset link has been sent."
      });
    }

    console.log('✅ Organization found:', organization.name);

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = await bcrypt.hash(resetToken, 10);
    
    // Set expiration (1 hour from now)
    const expires = new Date(Date.now() + 60 * 60 * 1000);

    // Delete any existing reset tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { identifier: email.toLowerCase() }
    });

    // Store reset token
    await prisma.passwordResetToken.create({
      data: {
        identifier: email.toLowerCase(),
        token: hashedToken,
        expires: expires
      }
    });

    console.log('✅ Reset token created and stored');

    // Create reset URL - organization-specific reset page
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
    const resetUrl = `${baseUrl}/organization/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    console.log('🔍 Reset URL created:', resetUrl);
    console.log('🔍 Base URL used:', baseUrl);

    // Send password reset email using email service
    let emailSent = false;
    let emailError = null;

    try {
      console.log('📧 Attempting to send organization password reset email...');
      const emailResult = await emailService.sendOrganizationPasswordResetEmail({
        organization: organization,
        resetToken: resetToken,
        resetLink: resetUrl
      });
      
      console.log('📧 Email service response:', JSON.stringify(emailResult, null, 2));

      if (emailResult.success) {
        emailSent = true;
        console.log('✅ Organization password reset email sent successfully');
      } else {
        emailError = emailResult.error;
        console.error('❌ Email sending failed:', emailResult.error);
      }
    } catch (emailErr) {
      emailError = emailErr.message;
      console.error('❌ Email sending error:', emailErr.message);
    }

    // Return response
    if (emailSent) {
      return NextResponse.json({
        success: true,
        message: "Password reset link has been sent to your email."
      });
    } else {
      // If email sending fails, return the URL for development/testing
      return NextResponse.json({
        success: true,
        message: 'Password reset link generated',
        resetUrl: resetUrl,
        note: 'Please configure email settings in your .env file to send emails automatically',
        email_status: {
          sent: false,
          error: emailError
        }
      });
    }

  } catch (error) {
    console.error("❌ Organization forgot password error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        success: false,
        error: "Invalid email format",
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: false,
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
