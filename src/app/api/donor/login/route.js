import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { compare } from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";
import { corsHeaders } from '@/app/lib/cors';

// Zod schema for donor login
const donorLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password is required"),
  twoFactorCode: z.string().optional(), // Optional 2FA code
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password, twoFactorCode } = donorLoginSchema.parse(body);

    // Check if donor exists in donors table only
    // Workaround for broken Prisma Client
    const donors = await prisma.$queryRaw`SELECT * FROM donors WHERE email = ${email}`;
    const donorRaw = donors[0];
    
    let organization = null;
    if (donorRaw && donorRaw.organization_id) {
        organization = await prisma.organization.findUnique({
            where: { id: donorRaw.organization_id },
            select: {
                id: true,
                name: true,
                email: true
            }
        });
    }

    const donor = donorRaw ? { 
      ...donorRaw, 
      organization,
      twoFactorEnabled: donorRaw.two_factor_enabled ? Boolean(donorRaw.two_factor_enabled) : false,
      twoFactorSecret: donorRaw.two_factor_secret
    } : null;

    if (!donor) {
      return NextResponse.json({ 
        error: "Invalid email or password" 
      }, { status: 401 });
    }

    // Check if donor is verified
    if (!donor.status) {
      return NextResponse.json({ 
        error: "Email not verified. Please check your email and verify your account before logging in." 
      }, { status: 401 });
    }

    // Compare password
    const isPasswordCorrect = await compare(password, donor.password);
    if (!isPasswordCorrect) {
      return NextResponse.json({ 
        error: "Invalid email or password" 
      }, { status: 401 });
    }

    // If 2FA is enabled, verify the code
    if (donor.twoFactorEnabled) {
      if (!twoFactorCode) {
        return NextResponse.json({
          requiresTwoFactor: true,
          message: "Two-factor authentication code is required",
        }, { status: 200 });
      }

      // Verify 2FA code
      const { verifyTwoFactorToken } = await import("../../../lib/two-factor");
      const isValid = verifyTwoFactorToken(twoFactorCode, donor.twoFactorSecret);

      if (!isValid) {
        return NextResponse.json({ 
          error: "Invalid two-factor authentication code" 
        }, { status: 401 });
      }
    }

    const userPayload = {
      id: donor.id,
      email: donor.email,
      name: donor.name,
      role: 'DONOR',
      organization: donor.organization
    };

    // If account was system-created, force a password reset before entering the app
    if (donorRaw.must_reset_password) {
      const resetToken = jwt.sign(
        { id: donor.id, email: donor.email, role: 'DONOR', userType: 'donor', mustResetPassword: true },
        process.env.JWT_SECRET,
        { expiresIn: '15m' }
      );
      return NextResponse.json({
        requiresPasswordReset: true,
        token: resetToken,
        user: userPayload,
      });
    }

    // Normal login — issue full 7-day token
    const token = jwt.sign(
      { id: donor.id, email: donor.email, role: 'DONOR', userType: 'donor' },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return NextResponse.json({
      message: "Donor login successful",
      token,
      user: userPayload,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Donor login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
