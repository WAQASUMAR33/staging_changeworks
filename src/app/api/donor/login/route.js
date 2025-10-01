import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { compare } from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";

// Zod schema for donor login
const donorLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password is required"),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = donorLoginSchema.parse(body);

    // Check if donor exists in donors table only
    const donor = await prisma.donor.findUnique({ 
      where: { email },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

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

    // Create JWT payload
    const tokenPayload = {
      id: donor.id,
      email: donor.email,
      role: 'DONOR',
      userType: 'donor'
    };

    // Sign token
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return NextResponse.json({
      message: "Donor login successful",
      token,
      user: {
        id: donor.id,
        email: donor.email,
        name: donor.name,
        role: 'DONOR',
        organization: donor.organization
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Donor login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}