import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import crypto from "crypto";
import emailService from "../../../lib/email-service";

const forgotPasswordSchema = z.object({
  email: z.string().email("Invalid email format"),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { email } = forgotPasswordSchema.parse(body);

    console.log('🔍 Password reset requested for:', email);

    // Check if donor exists
    const donor = await prisma.donor.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    if (!donor) {
      // Don't reveal if email exists or not for security
      return NextResponse.json({
        success: true,
        message: "If an account with that email exists, a password reset link has been sent."
      });
    }

    console.log('✅ Donor found:', donor.name);

    // Generate reset token
    const resetToken = crypto.randomUUID();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Delete any existing reset tokens for this email
    await prisma.passwordResetToken.deleteMany({
      where: { identifier: email }
    });

    // Store new reset token
    await prisma.passwordResetToken.create({
      data: {
        identifier: email,
        token: resetToken,
        expires,
      },
    });

    console.log('✅ Reset token created and stored');

    // Try to send email (but don't fail if email service is down)
    let emailSent = false;
    let emailError = null;

    try {
      const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/donor/reset-password?token=${resetToken}`;

      const emailResult = await emailService.sendPasswordResetEmail({
        donor: {
          name: donor.name,
          email: donor.email
        },
        resetToken,
        resetLink: resetUrl,
        organization: donor.organization
      });

      if (emailResult.success) {
        emailSent = true;
        console.log('✅ Password reset email sent successfully');
      } else {
        emailError = emailResult.error || 'Failed to send password reset email';
        console.error('❌ Password reset email sending failed:', emailError);
      }
    } catch (emailErr) {
      emailError = emailErr.message;
      console.error('❌ Email sending failed:', emailErr.message);
    }

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? "Password reset link has been sent to your email."
        : "Password reset token generated. Email service not configured.",
      email_status: {
        sent: emailSent,
        error: emailError,
        reset_token: emailSent ? undefined : resetToken // Include token if email failed
      },
      security_note: "This response is the same whether the email exists or not for security reasons."
    });

  } catch (error) {
    console.error("❌ Forgot password error:", error);
    
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
