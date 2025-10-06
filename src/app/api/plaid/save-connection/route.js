import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import jwt from "jsonwebtoken";

const schema = z.object({
  organization_id: z.number().int().positive(),
  access_token: z.string().min(1),
  item_id: z.string().min(1),
  institution_id: z.string().optional().nullable(),
  institution_name: z.string().optional().nullable(),
  accounts: z.array(z.any()).default([]), // pass through JSON array
  status: z.string().default('ACTIVE')
});

export async function POST(request) {
  try {
    const auth = request.headers.get('authorization');
    if (!auth || !auth.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    let donorId;
    try {
      const token = auth.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      donorId = decoded.id;
    } catch (e) {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }

    const body = await request.json();
    const data = schema.parse(body);

    // Ensure donor and organization exist
    const [donor, organization] = await Promise.all([
      prisma.donor.findUnique({ where: { id: donorId }, select: { id: true } }),
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
        donor_id: donorId,
        organization_id: data.organization_id,
        access_token: data.access_token,
        item_id: data.item_id,
        institution_id: data.institution_id || null,
        institution_name: data.institution_name || null,
        accounts: JSON.stringify(data.accounts || []),
        status: data.status || 'ACTIVE',
        donor: { connect: { id: donorId } },
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
    console.error('save-connection error:', error);
    return NextResponse.json({ success: false, error: 'Failed to save connection', details: error.message }, { status: 500 });
  }
}


