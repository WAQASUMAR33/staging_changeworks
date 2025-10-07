import { NextResponse } from "next/server";
import { PrismaClient } from '@prisma/client';
import { z } from "zod";
import nodemailer from "nodemailer";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || 'https://app.changeworksfund.org';
    const resetUrl = `${baseUrl}/organization/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

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

        await transport.sendMail({
          to: email,
          from: process.env.EMAIL_FROM,
          subject: "Reset Your Organization Password - ChangeWorks",
          text: `Hello ${organization.name},\n\nYou requested a password reset for your organization account.\n\nClick the link below to reset your password:\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nChangeWorks Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #302E56; text-align: center;">ChangeWorks Password Reset</h2>
              <p>Hello <strong>${organization.name}</strong>,</p>
              <p>You requested a password reset for your organization account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #302E56; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #302E56;">${resetUrl}</p>
              <p><strong>This link will expire in 1 hour for security reasons.</strong></p>
              <p>If you didn't request this password reset, please ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                This is an automated message from ChangeWorks. Please do not reply to this email.
              </p>
            </div>
          `,
        });

        emailSent = true;
        console.log('✅ Organization password reset email sent successfully');
      } else {
        console.log('⚠️ Email server not configured, skipping email');
      }
    } catch (emailErr) {
      emailError = emailErr.message;
      console.error('❌ Email sending failed:', emailErr.message);
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
  } finally {
    await prisma.$disconnect();
  }
}

