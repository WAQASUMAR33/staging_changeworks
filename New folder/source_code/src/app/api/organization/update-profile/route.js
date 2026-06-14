import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";
import jwt from "jsonwebtoken";

const updateProfileSchema = z.object({
  name: z.string().min(1, "Organization name is required").optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  website: z.string().url("Invalid website URL").optional().or(z.literal("")),
  company: z.string().optional(),
  postalCode: z.string().optional(),
});

export async function PUT(request) {
  try {
    const body = await request.json();
    const { name, phone, address, city, state, country, website, company, postalCode } = updateProfileSchema.parse(body);

    console.log('🔍 Organization profile update request received');

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

    // Find the organization
    const organization = await prisma.organization.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        country: true,
        website: true,
        company: true,
        postalCode: true
      }
    });

    if (!organization) {
      return NextResponse.json({
        success: false,
        error: "Organization not found",
        message: "The organization account was not found"
      }, { status: 404 });
    }

    console.log('✅ Organization found:', organization.name);

    // Prepare update data (only include fields that are provided and not empty)
    const updateData = {};
    
    if (name !== undefined) {
      updateData.name = name;
    }
    if (phone !== undefined) {
      updateData.phone = phone || null; // Allow clearing phone
    }
    if (address !== undefined) {
      updateData.address = address || null; // Allow clearing address
    }
    if (city !== undefined) {
      updateData.city = city || null; // Allow clearing city
    }
    if (state !== undefined) {
      updateData.state = state || null; // Allow clearing state
    }
    if (country !== undefined) {
      updateData.country = country || null; // Allow clearing country
    }
    if (website !== undefined) {
      updateData.website = website || null; // Allow clearing website
    }
    if (company !== undefined) {
      updateData.company = company || null; // Allow clearing company
    }
    if (postalCode !== undefined) {
      updateData.postalCode = postalCode || null; // Allow clearing postalCode
    }

    // Add updated_at timestamp
    updateData.updated_at = new Date();

    // Check if there's anything to update
    if (Object.keys(updateData).length <= 1) { // Only updated_at
      return NextResponse.json({
        success: false,
        error: "No valid fields to update",
        message: "Please provide at least one field to update"
      }, { status: 400 });
    }

    // Update the organization's profile
    const updatedOrganization = await prisma.organization.update({
      where: { id: organization.id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        address: true,
        city: true,
        state: true,
        country: true,
        website: true,
        company: true,
        postalCode: true,
        updated_at: true
      }
    });

    console.log('✅ Profile updated successfully for organization:', organization.name);

    return NextResponse.json({
      success: true,
      message: "Profile updated successfully",
      organization: {
        id: updatedOrganization.id,
        name: updatedOrganization.name,
        email: updatedOrganization.email,
        phone: updatedOrganization.phone,
        address: updatedOrganization.address,
        city: updatedOrganization.city,
        state: updatedOrganization.state,
        country: updatedOrganization.country,
        website: updatedOrganization.website,
        company: updatedOrganization.company,
        postalCode: updatedOrganization.postalCode,
        updated_at: updatedOrganization.updated_at
      },
      updated_fields: Object.keys(updateData).filter(key => key !== 'updated_at'),
      security_info: {
        profile_updated: true,
        protected_fields: ["email"],
        editable_fields: ["name", "phone", "address", "city", "state", "country", "website", "company", "postalCode"]
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
