import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";

// Validation schema for GHL account
const ghlAccountSchema = z.object({
  organizationId: z.number().int().positive(),
  ghlLocationId: z.string().min(1, "GHL Location ID is required"),
  businessName: z.string().min(1, "Business name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  timezone: z.string().optional(),
  apiKey: z.string().optional(),
  ghlData: z.string().optional(), // JSON string
});

export async function POST(req) {
  try {
    const body = await req.json();
    const input = ghlAccountSchema.parse(body);

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: input.organizationId },
    });

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // Check if GHL account already exists
    const existingAccount = await prisma.gHLAccount.findUnique({
      where: { ghl_location_id: input.ghlLocationId },
    });

    if (existingAccount) {
      return NextResponse.json({ error: "GHL account already exists" }, { status: 400 });
    }

    // Create GHL account
    const ghlAccount = await prisma.gHLAccount.create({
      data: {
        organization_id: input.organizationId,
        ghl_location_id: input.ghlLocationId,
        business_name: input.businessName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        city: input.city,
        state: input.state,
        country: input.country,
        postal_code: input.postalCode,
        website: input.website,
        timezone: input.timezone,
        api_key: input.apiKey || null,
        ghl_data: input.ghlData,
        status: "active"
      },
    });

    return NextResponse.json({
      message: "GHL account created successfully",
      ghlAccount
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }

    console.error("GHL account creation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    const ghlAccounts = await prisma.gHLAccount.findMany({
      where: { 
        organization_id: parseInt(organizationId),
        status: "active"
      },
      orderBy: { created_at: 'desc' },
    });

    return NextResponse.json({
      ghlAccounts
    }, { status: 200 });

  } catch (error) {
    console.error("GHL accounts fetch error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }

    const body = await req.json();
    const updateData = {};

    // Only update provided fields
    if (body.businessName) updateData.business_name = body.businessName;
    if (body.email) updateData.email = body.email;
    if (body.phone !== undefined) updateData.phone = body.phone;
    if (body.address !== undefined) updateData.address = body.address;
    if (body.city !== undefined) updateData.city = body.city;
    if (body.state !== undefined) updateData.state = body.state;
    if (body.country !== undefined) updateData.country = body.country;
    if (body.postalCode !== undefined) updateData.postal_code = body.postalCode;
    if (body.website !== undefined) updateData.website = body.website;
    if (body.timezone !== undefined) updateData.timezone = body.timezone;
    if (body.status) updateData.status = body.status;

    const updatedAccount = await prisma.gHLAccount.update({
      where: { id: parseInt(accountId) },
      data: updateData,
    });

    return NextResponse.json({
      message: "GHL account updated successfully",
      ghlAccount: updatedAccount
    }, { status: 200 });

  } catch (error) {
    console.error("GHL account update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const accountId = searchParams.get('id');

    if (!accountId) {
      return NextResponse.json({ error: "Account ID is required" }, { status: 400 });
    }

    // Soft delete by setting status to inactive
    const deletedAccount = await prisma.gHLAccount.update({
      where: { id: parseInt(accountId) },
      data: { status: "inactive" },
    });

    return NextResponse.json({
      message: "GHL account deleted successfully",
      ghlAccount: deletedAccount
    }, { status: 200 });

  } catch (error) {
    console.error("GHL account deletion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
