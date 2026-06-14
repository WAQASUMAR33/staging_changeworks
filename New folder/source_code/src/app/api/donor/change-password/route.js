import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import { hash, compare } from "bcryptjs";
import jwt from "jsonwebtoken";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password confirmation is required"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "New passwords don't match",
  path: ["confirmPassword"],
});

export async function POST(request) {
  try {
    const body = await request.json();
    const { currentPassword, newPassword, confirmPassword } = changePasswordSchema.parse(body);

    console.log('🔍 Password change request received');

    // Get the authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({
        success: false,
        error: "Authorization token required",
        message: "Please provide a valid authorization token"
      }, { status: 401 });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify the JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtError) {
      return NextResponse.json({
        success: false,
        error: "Invalid or expired token",
        message: "Please log in again"
      }, { status: 401 });
    }

    // Find the donor
    const donor = await prisma.donor.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    if (!donor) {
      return NextResponse.json({
        success: false,
        error: "Donor not found",
        message: "The donor account was not found"
      }, { status: 404 });
    }

    console.log('✅ Donor found:', donor.name);

    // Verify current password
    const isCurrentPasswordValid = await compare(currentPassword, donor.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json({
        success: false,
        error: "Current password is incorrect",
        message: "The current password you entered is incorrect"
      }, { status: 400 });
    }

    console.log('✅ Current password verified');

    // Check if new password is different from current password
    const isSamePassword = await compare(newPassword, donor.password);
    if (isSamePassword) {
      return NextResponse.json({
        success: false,
        error: "New password must be different",
        message: "The new password must be different from your current password"
      }, { status: 400 });
    }

    // Hash the new password
    const hashedNewPassword = await hash(newPassword, 10);

    // Update the donor's password
    await prisma.donor.update({
      where: { id: donor.id },
      data: { 
        password: hashedNewPassword,
        updated_at: new Date()
      }
    });

    console.log('✅ Password updated successfully for donor:', donor.name);

    return NextResponse.json({
      success: true,
      message: "Password has been changed successfully",
      donor_info: {
        name: donor.name,
        email: donor.email,
        organization: donor.organization.name
      },
      security_info: {
        password_updated: true,
        updated_at: new Date().toISOString(),
        next_step: "You can continue using the application with your new password"
      }
    });

  } catch (error) {
    console.error("❌ Change password error:", error);
    
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
