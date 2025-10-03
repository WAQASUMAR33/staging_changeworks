import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";

// POST /api/donor/signup - Create a new donor account
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      name, 
      email, 
      password, 
      phone, 
      city,
      address,
      postal_code,
      country = 'US',
      organization_id
    } = body;

    // Validate required fields
    if (!name || !email || !password || !phone || !address || !city || !postal_code || !organization_id) {
      return NextResponse.json(
        { success: false, error: 'All required fields must be provided' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Check if donor already exists
    const existingDonor = await prisma.donor.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingDonor) {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Generate verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create donor
    const donor = await prisma.donor.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        phone: phone.trim(),
        address: address.trim(),
        city: city.trim(),
        postal_code: String(postal_code).trim(),
        country: country,
        status: false, // false means not verified yet
        organization: { connect: { id: Number(organization_id) } }
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        postal_code: true,
        country: true,
        status: true,
        created_at: true
      }
    });

    // Store verification token
    await prisma.donorVerificationToken.create({
      data: {
        identifier: email.toLowerCase().trim(),
        token: verificationToken,
        expires,
      },
    });

    // Send verification email
    let emailSent = false;
    let emailError = null;

    try {
      // Check if email configuration is available
      const hasEmailConfig = process.env.EMAIL_SERVER_HOST && 
                            process.env.EMAIL_SERVER_PORT && 
                            process.env.EMAIL_SERVER_USER && 
                            process.env.EMAIL_SERVER_PASSWORD && 
                            process.env.EMAIL_FROM;

      if (hasEmailConfig) {
        const transport = nodemailer.createTransport({
          host: process.env.EMAIL_SERVER_HOST,
          port: Number(process.env.EMAIL_SERVER_PORT),
          auth: {
            user: process.env.EMAIL_SERVER_USER,
            pass: process.env.EMAIL_SERVER_PASSWORD,
          },
        });

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const verificationUrl = `${baseUrl}/donor/verify?token=${verificationToken}&email=${encodeURIComponent(email)}`;

        await transport.sendMail({
          to: email,
          from: process.env.EMAIL_FROM,
          subject: "Welcome to ChangeWorks - Please Verify Your Email",
          text: `Hello ${name},\n\nThank you for signing up with ChangeWorks! Please verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nBest regards,\nChangeWorks Team`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #302E56; margin: 0;">Welcome to ChangeWorks!</h1>
                <p style="color: #6b7280; margin: 10px 0 0 0;">Thank you for joining our community</p>
              </div>
              
              <div style="background: #f8fafc; padding: 30px; border-radius: 10px; margin-bottom: 30px;">
                <h2 style="color: #302E56; margin-top: 0;">Hello ${name},</h2>
                <p style="color: #374151; line-height: 1.6; margin-bottom: 20px;">
                  Thank you for signing up with ChangeWorks! We're excited to have you join our community of donors making a difference.
                </p>
                <p style="color: #374151; line-height: 1.6; margin-bottom: 30px;">
                  To complete your registration and start making donations, please verify your email address by clicking the button below:
                </p>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationUrl}" 
                     style="background-color: #302E56; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold; font-size: 16px;">
                    Verify Email Address
                  </a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px; margin-top: 20px;">
                  If the button doesn't work, copy and paste this link into your browser:<br>
                  <span style="word-break: break-all; color: #302E56;">${verificationUrl}</span>
                </p>
              </div>
              
              <div style="background: #e0f2fe; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
                <h3 style="color: #302E56; margin-top: 0;">What's Next?</h3>
                <ul style="color: #374151; line-height: 1.6; margin: 0; padding-left: 20px;">
                  <li>Verify your email address (this email)</li>
                  <li>Log in to your donor dashboard</li>
                  <li>Browse organizations and causes you care about</li>
                  <li>Start making donations and subscriptions</li>
                </ul>
              </div>
              
              <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; text-align: center;">
                <p style="color: #6b7280; font-size: 14px; margin: 0;">
                  This verification link will expire in 24 hours for security reasons.
                </p>
                <p style="color: #6b7280; font-size: 14px; margin: 10px 0 0 0;">
                  If you didn't create this account, please ignore this email.
                </p>
              </div>
              
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; text-align: center; margin: 0;">
                This is an automated message from ChangeWorks. Please do not reply to this email.
              </p>
            </div>
          `,
        });

        emailSent = true;
        console.log(`✅ Verification email sent successfully to: ${email}`);
      } else {
        console.log('⚠️ Email server not configured, skipping verification email');
        emailError = 'Email service not configured';
      }
    } catch (emailErr) {
      emailError = emailErr.message;
      console.error('❌ Verification email sending failed:', emailErr.message);
    }

    console.log(`New donor created: ${email}`);

    return NextResponse.json({
      success: true,
      message: emailSent 
        ? 'Account created successfully! Please check your email to verify your account before logging in.'
        : 'Account created successfully! Please contact support for email verification.',
      donor: donor,
      email_status: {
        sent: emailSent,
        error: emailError,
        verification_token: emailSent ? undefined : verificationToken // Include token if email failed
      }
    });

  } catch (error) {
    console.error('Donor signup error:', error);
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}
