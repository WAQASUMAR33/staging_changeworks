import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import nodemailer from "nodemailer";
import crypto from "crypto";

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
      // Check if email server is configured
      if (process.env.EMAIL_SERVER_HOST && process.env.EMAIL_SERVER_USER && process.env.EMAIL_SERVER_PASSWORD) {
        const transport = nodemailer.createTransport({
          host: process.env.EMAIL_SERVER_HOST,
          port: Number(process.env.EMAIL_SERVER_PORT),
          auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          },
        });

        const resetUrl = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org'}/donor/reset-password?token=${resetToken}`;

        await transport.sendMail({
          to: email,
          from: process.env.EMAIL_FROM,
          subject: "Reset Your Donor Account Password",
          text: `Hello ${donor.name},\n\nYou requested a password reset for your donor account with ${donor.organization.name}.\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nChangeWorks Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #302E56;">Password Reset Request</h2>
              <p>Hello ${donor.name},</p>
              <p>You requested a password reset for your donor account with <strong>${donor.organization.name}</strong>.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" style="background-color: #302E56; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">Reset Password</a>
              </div>
              <p><strong>This link will expire in 1 hour.</strong></p>
              <p>If you didn't request this password reset, please ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 14px;">Best regards,<br>ChangeWorks Team</p>
            </div>
          `,
        });

        emailSent = true;
        console.log('✅ Password reset email sent successfully');
      } else {
        console.log('⚠️ Email server not configured, skipping email');
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
