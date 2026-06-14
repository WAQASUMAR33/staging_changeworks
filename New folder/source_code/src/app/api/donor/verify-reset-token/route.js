import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";

const verifyTokenSchema = z.object({
  token: z.string().min(1, "Token is required"),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = verifyTokenSchema.parse(body);

    console.log('🔍 Verifying reset token:', token.substring(0, 8) + '...');

    // Find the reset token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: {
        // We don't need to include donor data here for security
      }
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

    // Verify that the donor still exists
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

    console.log('✅ Reset token is valid for donor:', donor.name);

    return NextResponse.json({
      success: true,
      message: "Reset token is valid",
      donor_info: {
        name: donor.name,
        email: donor.email,
        organization: donor.organization.name
      },
      token_info: {
        expires_at: resetToken.expires,
        time_remaining_minutes: Math.max(0, Math.floor((resetToken.expires - new Date()) / (1000 * 60)))
      }
    });

  } catch (error) {
    console.error("❌ Verify reset token error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({ 
        success: false,
        error: "Invalid token format",
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
