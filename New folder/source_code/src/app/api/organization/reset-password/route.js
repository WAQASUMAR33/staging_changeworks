import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const prisma = new PrismaClient();

const resetPasswordSchema = z.object({
  token: z.string(),
  email: z.string().email(),
  newPassword: z.string().min(6, 'Password must be at least 6 characters long'),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, email, newPassword } = resetPasswordSchema.parse(body);

    console.log('🔍 Organization password reset for:', email);

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findFirst({
      where: {
        identifier: email.toLowerCase(),
        expires: {
          gt: new Date()
        }
      }
    });

    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset token. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Verify the token
    const isValidToken = await bcrypt.compare(token, resetToken.token);
    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Invalid reset token. Please request a new password reset.' },
        { status: 400 }
      );
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update organization password (update both password fields for compatibility)
    await prisma.organization.update({
      where: { email: email.toLowerCase() },
      data: { 
        password: hashedPassword,
        orgPassword: hashedPassword,
        updated_at: new Date()
      }
    });

    console.log('✅ Organization password updated successfully');

    // Delete the used reset token
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id }
    });

    console.log('✅ Reset token deleted');

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('❌ Organization reset password error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        error: error.errors[0]?.message || 'Invalid input data',
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}

