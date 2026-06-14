import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import nodemailer from 'nodemailer';

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

    const donor = await prisma.donor.findUnique({
      where: { email: email.toLowerCase() }
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

    // Create reset URL - ALWAYS use reset-password endpoint
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
    const resetUrl = `${baseUrl}/reset-password?token=${resetToken}&email=${encodeURIComponent(email)}`;

    // Check if email configuration is available
    const hasEmailConfig = process.env.EMAIL_SERVER_HOST && 
                          process.env.EMAIL_SERVER_PORT && 
                          process.env.EMAIL_SERVER_USER && 
                          process.env.EMAIL_SERVER_PASSWORD && 
                          process.env.EMAIL_FROM;

    if (hasEmailConfig) {
      // Send email with reset link
      try {
        const transport = nodemailer.createTransporter({
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
          subject: "Reset Your Password - ChangeWorks",
          text: `You requested a password reset. Click the following link to reset your password: ${resetUrl}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #302E56; text-align: center;">ChangeWorks Password Reset</h2>
              <p>Hello,</p>
              <p>You requested a password reset for your ChangeWorks account.</p>
              <p>Click the button below to reset your password:</p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" 
                   style="background-color: #302E56; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p style="word-break: break-all; color: #302E56;">${resetUrl}</p>
              <p>This link will expire in 1 hour for security reasons.</p>
              <p>If you didn't request this password reset, please ignore this email.</p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                This is an automated message from ChangeWorks. Please do not reply to this email.
              </p>
            </div>
          `,
        });

        return NextResponse.json({
          message: 'Password reset link sent to your email'
        });

      } catch (emailError) {
        console.error('Email sending error:', emailError);
        
        // If email sending fails, return the URL for development/testing
        return NextResponse.json({
          message: 'Password reset link generated (email sending failed)',
          resetUrl: resetUrl,
          note: 'Please configure email settings in your .env file'
        });
      }
    } else {
      // No email configuration - return URL for development
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
