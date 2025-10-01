import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";

// Validation schema for PUT requests
const updateOrganizationSchema = z.object({
  name: z.string().min(1, "Name is required").optional(),
  email: z.string().email("Invalid email").max(100).optional(),
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  phone: z.string().optional(),
  company: z.string().optional(),
  address: z.string().optional(),
  website: z.string().url().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
  ghlId: z.string().optional(),
  imageUrl: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

export async function GET(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    // Convert id to integer
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: parsedId }});

    if (!organization) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    return NextResponse.json({ organization }, { status: 200 });
  } catch (error) {
    console.error("Error fetching organization:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = await params;
    const body = await req.json();
    const input = updateOrganizationSchema.parse(body);

    if (!id) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    // Convert id to integer
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    const existing = await prisma.organization.findUnique({
      where: { id: parsedId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    // If email is being updated, check for conflicts
    if (input.email && input.email !== existing.email) {
      const emailExists = await prisma.organization.findUnique({
        where: { email: input.email },
      });
      if (emailExists) {
        return NextResponse.json({ error: "Email already exists" }, { status: 400 });
      }
    }

    // If password is provided, hash it
    const updateData = { ...input };
    if (input.password) {
      const { hash } = await import("bcryptjs");
      updateData.password = await hash(input.password, 10);
    }

    const organization = await prisma.organization.update({
      where: { id: parsedId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        phone: true,
        company: true,
        address: true,
        website: true,
        city: true,
        state: true,
        country: true,
        postalCode: true,
        ghlId: true,
        status: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({
      message: "Organization updated successfully",
      organization,
    }, { status: 200 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors }, { status: 400 });
    }
    console.error("Update error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: "Organization ID is required" }, { status: 400 });
    }

    // Convert id to integer
    const parsedId = parseInt(id, 10);
    if (isNaN(parsedId)) {
      return NextResponse.json({ error: "Invalid organization ID" }, { status: 400 });
    }

    const existing = await prisma.organization.findUnique({
      where: { id: parsedId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }

    await prisma.organization.delete({
      where: { id: parsedId },
    });

    return NextResponse.json({ message: "Organization deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}