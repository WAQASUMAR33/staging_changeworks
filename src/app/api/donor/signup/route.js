import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import nodemailer from "nodemailer";
import { emailService } from "../../../lib/email-service.jsx";

// POST /api/donor/signup - Create a new donor account
export async function POST(request) {
  try {
    const body = await request.json();
    const { 
      name, 
      email, 
      password, 
      phone, 
      postal_code,
      country = 'US',
      organization_id
    } = body;

    // Validate required fields
    if (!name || !email || !password || !phone || !postal_code || !organization_id) {
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
        address: null, // No longer required
        city: null, // No longer required
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
      // Get organization details for the email
      const organization = await prisma.organization.findUnique({
        where: { id: Number(organization_id) },
        select: { id: true, name: true, email: true }
      });

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
      const verificationUrl = `${baseUrl}/api/verify-donor?token=${verificationToken}`;

      const emailResult = await emailService.sendVerificationEmail({
        donor: {
          name: name.trim(),
          email: email.toLowerCase().trim()
        },
        verificationToken,
        verificationLink: verificationUrl,
        organization
      });

      if (emailResult.success) {
        emailSent = true;
        console.log(`✅ Verification email sent successfully to: ${email}`);
      } else {
        emailError = emailResult.error || 'Failed to send verification email';
        console.error('❌ Verification email sending failed:', emailError);
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
