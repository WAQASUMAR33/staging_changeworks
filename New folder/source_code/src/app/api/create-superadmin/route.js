import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { name, email, password, secretKey } = await request.json();

    // Security check - require a secret key
    const ADMIN_CREATION_SECRET = process.env.ADMIN_CREATION_SECRET;
    
    if (!ADMIN_CREATION_SECRET) {
      return NextResponse.json(
        { error: 'Server configuration error: ADMIN_CREATION_SECRET not set in environment variables' },
        { status: 500 }
      );
    }
    
    if (!secretKey || secretKey !== ADMIN_CREATION_SECRET) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid secret key' },
        { status: 401 }
      );
    }

    // Validate input
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Name, email, and password are required' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Please provide a valid email address' },
        { status: 400 }
      );
    }

    // Validate password length
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      return NextResponse.json(
        { 
          error: 'User already exists',
          user: {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role
          }
        },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create super admin user
    const superAdmin = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        role: 'SUPERADMIN',
        emailVerified: new Date(), // Mark as verified
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        created_at: true,
      }
    });

    console.log('✅ Super Admin account created successfully:', superAdmin.email);

    return NextResponse.json({
      success: true,
      message: 'Super Admin account created successfully',
      user: {
        id: superAdmin.id,
        name: superAdmin.name,
        email: superAdmin.email,
        role: superAdmin.role,
        created_at: superAdmin.created_at
      },
      credentials: {
        email: email.toLowerCase().trim(),
        password: '****** (hidden for security)',
        loginUrl: '/login'
      }
    });

  } catch (error) {
    console.error('❌ Error creating super admin:', error);
    
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create super admin account', details: error.message },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

// GET method to show instructions
export async function GET() {
  return NextResponse.json({
    message: 'Super Admin Creation Endpoint',
    instructions: {
      method: 'POST',
      endpoint: '/api/create-superadmin',
      requiredFields: {
        name: 'Full name of the super admin',
        email: 'Email address (must be unique)',
        password: 'Password (minimum 8 characters)',
        secretKey: 'Secret key from environment variable ADMIN_CREATION_SECRET'
      },
      example: {
        name: 'Super Admin',
        email: 'superadmin@changeworksfund.org',
        password: 'YourSecurePassword123!',
        secretKey: 'your-secret-key-here'
      }
    },
    security: 'This endpoint requires a secret key to prevent unauthorized super admin creation'
  });
}

