import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function POST(request) {
  try {
    const { token, email, newPassword } = await request.json();

    if (!token || !email || !newPassword) {
      return NextResponse.json(
        { error: 'Token, email, and new password are required' },
        { status: 400 }
      );
    }

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
        { error: 'Invalid or expired reset token' },
        { status: 400 }
      );
    }

    // Verify the token
    const isValidToken = await bcrypt.compare(token, resetToken.token);
    if (!isValidToken) {
      return NextResponse.json(
        { error: 'Invalid reset token' },
        { status: 400 }
      );
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password (check both User and Donor tables)
    let updatedUser = null;
    
    // Try to update User table first
    updatedUser = await prisma.user.updateMany({
      where: { email: email.toLowerCase() },
      data: { password: hashedPassword }
    });

    // If no user was updated, try Donor table
    if (updatedUser.count === 0) {
      updatedUser = await prisma.donor.updateMany({
        where: { email: email.toLowerCase() },
        data: { password: hashedPassword }
      });
    }

    if (updatedUser.count === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the used reset token
    await prisma.passwordResetToken.delete({
      where: { id: resetToken.id }
    });

    return NextResponse.json({
      message: 'Password reset successfully'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
