import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";

const MAX_VARCHAR = 255;
const schema = z.object({
  donor_id: z.number().int().positive(),
  organization_id: z.number().int().positive(),
  access_token: z.string().min(1).max(MAX_VARCHAR),
  item_id: z.string().min(1).max(MAX_VARCHAR),
  institution_id: z.string().max(MAX_VARCHAR).optional().nullable(),
  institution_name: z.string().max(MAX_VARCHAR).optional().nullable(),
  accounts: z.array(z.any()).default([]), // pass through JSON array
  status: z.string().max(50).default('ACTIVE'),
  error_message: z.string().max(500).optional().nullable()
});

export async function POST(request) {
  try {
    const body = await request.json();
    const data = schema.parse(body);

    // Ensure donor and organization exist
    const [donor, organization] = await Promise.all([
      prisma.donor.findUnique({ where: { id: data.donor_id }, select: { id: true } }),
      prisma.organization.findUnique({ where: { id: data.organization_id }, select: { id: true } })
    ]);

    if (!donor) {
      return NextResponse.json({ success: false, error: 'Donor not found' }, { status: 404 });
    }
    if (!organization) {
      return NextResponse.json({ success: false, error: 'Organization not found' }, { status: 404 });
    }

    const saved = await prisma.plaidConnection.create({
      data: {
        donor_id: data.donor_id,
        organization_id: data.organization_id,
        access_token: data.access_token,
        item_id: data.item_id,
        institution_id: data.institution_id || null,
        institution_name: data.institution_name || null,
        accounts: JSON.stringify(data.accounts || []),
        status: data.status || 'ACTIVE',
        error_message: data.error_message || null,
        donor: { connect: { id: data.donor_id } },
        organization: { connect: { id: data.organization_id } }
      },
      select: {
        id: true,
        donor_id: true,
        organization_id: true,
        institution_name: true,
        status: true,
        created_at: true
      }
    });

    return NextResponse.json({ success: true, connection: saved });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation error', details: error.errors }, { status: 400 });
    }
    // Handle unique constraint violations for access_token/item_id
    if (error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'Duplicate record', details: error.meta }, { status: 409 });
    }
    console.error('save-connection error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save connection', details: error.message }, { status: 500 });
  }
}


