import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { emailService } from "../../../lib/email-service";
import { corsHeaders } from '@/app/lib/cors';

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

    // Validate required fields (organization_id removed)
    if (!name || !email || !password || !phone || !postal_code) {
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
    // Workaround for broken Prisma Client
    const existingDonors = await prisma.$queryRaw`
      SELECT id FROM donors WHERE email = ${email.toLowerCase()} LIMIT 1
    `;
    const existingDonor = existingDonors[0];

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

    // Validate and verify organization_id if provided
    let validOrganizationId = null;
    if (organization_id) {
      const orgId = Number(organization_id);
      // Check if it's a valid number and greater than 0
      if (isNaN(orgId) || orgId <= 0) {
        return NextResponse.json(
          { success: false, error: 'Invalid organization ID provided' },
          { status: 400 }
        );
      }
      
      // Verify organization exists
      const organization = await prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true }
      });
      
      if (!organization) {
        return NextResponse.json(
          { success: false, error: 'Organization not found' },
          { status: 404 }
        );
      }
      
      validOrganizationId = orgId;
    }

    // Create donor
    await prisma.$queryRaw`
      INSERT INTO donors (
        name,
        email,
        password,
        phone,
        postal_code,
        country,
        organization_id,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${name.trim()},
        ${email.toLowerCase().trim()},
        ${hashedPassword},
        ${phone.trim()},
        ${String(postal_code).trim()},
        ${country},
        ${validOrganizationId},
        0,
        ${new Date()},
        ${new Date()}
      )
    `;

    // Fetch the created donor
    const donors = await prisma.$queryRaw`
      SELECT 
        id, 
        name, 
        email, 
        phone, 
        address, 
        city, 
        postal_code, 
        country, 
        status, 
        created_at 
      FROM donors 
      WHERE email = ${email.toLowerCase().trim()} 
      ORDER BY created_at DESC 
      LIMIT 1
    `;
    const donor = donors[0];

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
      // Get organization details for the email ONLY if valid organization_id exists
      let organization = null;
      if (validOrganizationId) {
        organization = await prisma.organization.findUnique({
          where: { id: validOrganizationId },
          select: { id: true, name: true, email: true, imageUrl: true }
        });
      }

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
      const verificationUrl = `${baseUrl}/api/verify-donor?token=${verificationToken}`;

      const emailResult = await emailService.sendVerificationEmail({
        donor: {
          name: name.trim(),
          email: email.toLowerCase().trim()
        },
        verificationToken,
        verificationLink: verificationUrl,
        organization // Pass null if no organization
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

    // Handle foreign key constraint violation
    if (error.code === 'P2003') {
      return NextResponse.json(
        { success: false, error: 'Invalid organization ID. The organization does not exist.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Failed to create account. Please try again.' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
