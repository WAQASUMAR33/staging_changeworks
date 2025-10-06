import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import jwt from "jsonwebtoken";

const updateProfileSchema = z.object({
  phone: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  imageUrl: z.string().url("Invalid image URL").optional().or(z.literal("")),
});

export async function PUT(request) {
  try {
    const body = await request.json();
    const { phone, city, address, postal_code, country, imageUrl } = updateProfileSchema.parse(body);

    console.log('🔍 Profile update request received');

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
        phone: true,
        city: true,
        address: true,
        postal_code: true,
        country: true,
        imageUrl: true,
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

    // Prepare update data (only include fields that are provided and not empty)
    const updateData = {};
    
    if (phone !== undefined) {
      updateData.phone = phone || null; // Allow clearing phone
    }
    if (city !== undefined) {
      updateData.city = city || null; // Allow clearing city
    }
    if (address !== undefined) {
      updateData.address = address || null; // Allow clearing address
    }
    if (postal_code !== undefined) {
      updateData.postal_code = postal_code || null; // Allow clearing postal_code
    }
    if (country !== undefined) {
      updateData.country = country || null; // Allow clearing country
    }
    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl || null; // Allow clearing imageUrl
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date();

    // Check if there's anything to update
    if (Object.keys(updateData).length <= 1) { // Only updated_at
      return NextResponse.json({
        success: false,
        error: "No valid fields to update",
        message: "Please provide at least one field to update (phone, city, address, postal_code, country, or imageUrl)"
      }, { status: 400 });
    }

    // Update the donor's profile
    const updatedDonor = await prisma.donor.update({
      where: { id: donor.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        city: true,
        address: true,
        postal_code: true,
        country: true,
        imageUrl: true,
        updated_at: true,
        organization: {
          select: {
            name: true
          }
        }
      }
    });

    console.log('✅ Profile updated successfully for donor:', donor.name);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      donor: {
        id: updatedDonor.id,
        name: updatedDonor.name,
        email: updatedDonor.email,
        phone: updatedDonor.phone,
        city: updatedDonor.city,
        address: updatedDonor.address,
        postal_code: updatedDonor.postal_code,
        country: updatedDonor.country,
        imageUrl: updatedDonor.imageUrl,
        organization: updatedDonor.organization.name,
        updated_at: updatedDonor.updated_at
      },
      updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
      security_info: {
        profile_updated: true,
        protected_fields: ["name", "email"],
        editable_fields: ["phone", "city", "address", "postal_code", "country", "imageUrl"]
      }
    });

  } catch (error) {
    console.error("❌ Update profile error:", error);
    
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
