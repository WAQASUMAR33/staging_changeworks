import { NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { emailService } from '@/app/lib/email-service';
import { corsHeaders } from '@/app/lib/cors';

function generatePassword(length = 10) {
  // Use alphanumeric only so the password is easy to type
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let pwd = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    pwd += chars[bytes[i] % chars.length];
  }
  return pwd;
}

export async function POST(request) {
  try {
    const { first_name, last_name, email, phone, ghl_id } = await request.json();

    if (!email || !ghl_id) {
      return NextResponse.json({ error: 'email and ghl_id are required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Look up org by ghlId
    const organization = await prisma.organization.findFirst({
      where: { ghlId: ghl_id },
      select: { id: true, name: true, email: true, imageUrl: true, stripeAccountId: true },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found for this link. Please contact support.' },
        { status: 404 }
      );
    }

    // Check if donor already exists
    const existing = await prisma.$queryRaw`
      SELECT id, name, email FROM donors WHERE email = ${normalizedEmail} LIMIT 1
    `;

    if (existing.length > 0) {
      return NextResponse.json({
        exists: true,
        organization: { id: organization.id, name: organization.name },
      });
    }

    // Build donor name from URL params
    const name = [first_name, last_name].filter(Boolean).join(' ').trim() || normalizedEmail.split('@')[0];

    // Generate a readable password
    const plainPassword = generatePassword(10);
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    // Create donor with status=1 (verified) and must_reset_password=1 (force reset on first login)
    await prisma.$queryRaw`
      INSERT INTO donors (name, email, password, phone, country, organization_id, status, must_reset_password, created_at, updated_at)
      VALUES (
        ${name},
        ${normalizedEmail},
        ${hashedPassword},
        ${phone?.trim() || null},
        'US',
        ${organization.id},
        1,
        1,
        ${new Date()},
        ${new Date()}
      )
    `;

    const donors = await prisma.$queryRaw`
      SELECT id, name, email FROM donors WHERE email = ${normalizedEmail} ORDER BY created_at DESC LIMIT 1
    `;
    const donor = donors[0];

    // Short-lived token — just enough to complete the round-up setup (2 h)
    const token = jwt.sign(
      { id: donor.id, email: donor.email, role: 'DONOR', userType: 'donor' },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    // Send login credentials email (fire-and-forget)
    const appBase = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org').replace(/\/$/, '');
    emailService
      .sendDonorCredentialsEmail({
        donor: { name, email: normalizedEmail },
        organization,
        password: plainPassword,
        loginLink: `${appBase}/donor/login`,
      })
      .catch((err) => console.error('Failed to send credentials email:', err));

    return NextResponse.json({
      exists: false,
      token,
      donor: { id: donor.id, name: donor.name, email: donor.email },
      organization: {
        id: organization.id,
        name: organization.name,
        stripeAccountId: organization.stripeAccountId,
      },
    });
  } catch (error) {
    console.error('iroundup init error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
