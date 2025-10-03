import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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
        is_verified: false,
        verification_token: verificationToken,
        status: 'ACTIVE',
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
        is_verified: true,
        created_at: true
      }
    });

    // TODO: Send verification email
    // For now, we'll just log the verification token
    console.log(`Verification token for ${email}: ${verificationToken}`);
    console.log(`Verification URL: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/donor/verify?token=${verificationToken}`);

    return NextResponse.json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      donor: donor
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
