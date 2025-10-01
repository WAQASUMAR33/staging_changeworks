import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { compare } from "bcryptjs";
import { z } from "zod";
import jwt from "jsonwebtoken";

// Zod schema
const loginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password is required"),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = loginSchema.parse(body);

    // First check if user exists in users table
    let user = await prisma.user.findUnique({ where: { email } });
    let userType = 'user';

    // If not found in users table, check donors table
    if (!user) {
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
      
      if (donor) {
        // Check if donor is verified
        if (!donor.status) {
          return NextResponse.json({ 
            error: "Email not verified. Please check your email and verify your account before logging in." 
          }, { status: 401 });
        }

        // Compare password for donor
        const isPasswordCorrect = await compare(password, donor.password);
        if (!isPasswordCorrect) {
          return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
        }

        // Create user object for donor
        user = {
          id: donor.id,
          email: donor.email,
          name: donor.name,
          role: 'DONOR',
          organization: donor.organization
        };
        userType = 'donor';
      }
    }

    // If still no user found, return error
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // For regular users, compare password
    if (userType === 'user') {
      const isPasswordCorrect = await compare(password, user.password);
      if (!isPasswordCorrect) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }
    }

    // Create JWT payload
    const tokenPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      userType: userType
    };

    // Sign token
    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: "7d", // Adjust expiration as needed
    });

    return NextResponse.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        ...(user.organization && { organization: user.organization })
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("Login error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
