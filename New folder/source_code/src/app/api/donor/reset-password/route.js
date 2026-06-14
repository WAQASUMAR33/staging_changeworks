import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import { hash } from "bcryptjs";

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { token, newPassword, confirmPassword } = resetPasswordSchema.parse(body);

    console.log('🔍 Password reset attempt with token:', token.substring(0, 8) + '...');

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
    });

    if (!resetToken) {
      return NextResponse.json({
        success: false,
        error: "Invalid or expired reset token",
        message: "The reset token is invalid or has already been used."
      }, { status: 400 });
    }

    // Check if token is expired
    if (resetToken.expires < new Date()) {
      // Clean up expired token
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id }
      });

      return NextResponse.json({
        success: false,
        error: "Reset token has expired",
        message: "The reset token has expired. Please request a new password reset."
      }, { status: 400 });
    }

    // Find the donor
    const donor = await prisma.donor.findUnique({
      where: { email: resetToken.identifier },
      select: {
        id: true,
        name: true,
        email: true,
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    if (!donor) {
      // Clean up token for non-existent donor
      await prisma.passwordResetToken.delete({
        where: { id: resetToken.id }
      });

      return NextResponse.json({
        success: false,
        error: "Donor account not found",
        message: "The donor account associated with this reset token no longer exists."
      }, { status: 400 });
    }

    console.log('✅ Valid token found for donor:', donor.name);

    // Hash the new password
    const hashedPassword = await hash(newPassword, 10);

    // Update the donor's password and delete the reset token in a transaction
    await prisma.$transaction(async (tx) => {
      // Update the donor's password
      await tx.donor.update({
        where: { id: donor.id },
        data: { password: hashedPassword }
      });

      // Delete the used reset token
      await tx.passwordResetToken.delete({
        where: { id: resetToken.id }
      });
    });

    console.log('✅ Password updated successfully for donor:', donor.name);

    return NextResponse.json({
      success: true,
      message: "Password has been reset successfully",
      donor_info: {
        name: donor.name,
        email: donor.email,
        organization: donor.organization.name
      },
      security_info: {
        token_deleted: true,
        password_updated: true,
        next_step: "You can now log in with your new password"
      }
    });

  } catch (error) {
    console.error("❌ Reset password error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        success: false,
        error: "Validation failed",
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: false,
      error: "Internal server error",
      details: error.message
    }, { status: 500 });
  }
}
