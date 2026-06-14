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

    // Find verification token
    const verificationToken = await prisma.donorVerificationToken.findFirst({
      where: {
        token: token,
        expires: {
          gt: new Date()
        }
      }
    });

    if (!verificationToken) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired verification token' },
        { status: 400 }
      );
    }

    // Find donor by email
    const donor = await prisma.donor.findUnique({
      where: {
        email: verificationToken.identifier
      }
    });

    if (!donor) {
      return NextResponse.json(
        { success: false, error: 'Donor not found' },
        { status: 404 }
      );
    }

    // Update donor to verified
    const updatedDonor = await prisma.donor.update({
      where: { id: donor.id },
      data: {
        status: true // true means verified
      },
      select: {
        id: true,
        name: true,
        email: true,
        status: true,
        updated_at: true
      }
    });

    // Delete the used verification token
    await prisma.donorVerificationToken.delete({
      where: { id: verificationToken.id }
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
