import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// POST /api/donor/verify - Verify donor email
export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Verification token is required' },
        { status: 400 }
      );
    }

    // Find donor with the verification token
    const donor = await prisma.donor.findFirst({
      where: {
        verification_token: token,
        is_verified: false
      }
    });

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Update donor to verified
    const updatedDonor = await prisma.donor.update({
      where: { id: donor.id },
      data: {
        is_verified: true,
        verification_token: null // Clear the token after verification
      },
      select: {
        id: true,
        name: true,
        email: true,
        is_verified: true,
        updated_at: true
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully',
      donor: updatedDonor
    });

  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to verify email. Please try again.' },
      { status: 500 }
    );
  }
}
