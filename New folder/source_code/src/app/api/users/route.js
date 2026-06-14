import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma"; // Named import
import { hash } from "bcryptjs";
import { z } from "zod";
import nodemailer from "nodemailer";

const signupSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").max(100, "Email too long"), // Match schema
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: z.enum(["SUPERADMIN", "MANAGER", "ADMIN"]).optional().default("ADMIN"),
});

const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email address").max(100, "Email too long"),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  role: z.enum(["SUPERADMIN", "MANAGER", "ADMIN"]),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, password, role = "ADMIN" } = signupSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user
    await prisma.user.create({
      data: { 
        name, 
        email, 
        password: hashedPassword, 
        role 
      },
    });

    // Generate and store verification token
    const token = crypto.randomUUID();
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await prisma.verificationToken.create({
      data: { identifier: email, token, expires },
    });

    // Send verification email
    const transport = nodemailer.createTransport({
      host: process.env.EMAIL_SERVER_HOST,
      port: Number(process.env.EMAIL_SERVER_PORT),
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    });

    const verificationUrl = `${process.env.NEXTAUTH_URL}/api/auth/verify-email?token=${token}`;
    await transport.sendMail({
      to: email,
      from: process.env.EMAIL_FROM,
      subject: "Verify Your Email",
      text: `Please verify your email by clicking: ${verificationUrl}`,
      html: `<p>Please verify your email by clicking: <a href="${verificationUrl}">${verificationUrl}</a></p>`,
    });

    return NextResponse.json({ message: "User created. Please verify your email." }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET: Fetch all users
export async function GET(request) {
  try {
    // Fetch all users
    const users = await prisma.user.findMany({
      orderBy: {
        created_at: 'desc', // Optional: Order by creation date
      },
    });

    // Check if users exist
    if (!users || users.length === 0) {
      return NextResponse.json(
        { message: 'No users found' },
        { status: 404 }
      );
    }

    return NextResponse.json(users, { status: 200 });
  } catch (error) {
    console.error('Error fetching users:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// PUT: Update user
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, name, email, password, role } = updateUserSchema.parse(body);

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if email is already taken by another user
    const emailExists = await prisma.user.findFirst({
      where: {
        email,
        id: { not: parseInt(id) }
      }
    });
    if (emailExists) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    // Prepare update data
    const updateData = {
      name,
      email,
      role
    };

    // Hash password if provided
    if (password) {
      updateData.password = await hash(password, 10);
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(id) },
      data: updateData,
    });

    return NextResponse.json({ 
      message: "User updated successfully",
      user: updatedUser 
    }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error('Error updating user:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE: Delete user
export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: parseInt(id) } });
    if (!existingUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Delete user
    await prisma.user.delete({
      where: { id: parseInt(id) },
    });

    return NextResponse.json({ message: "User deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}