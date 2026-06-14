import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Fetch all fund transfers
export async function GET() {
  try {
    const fundTransfers = await prisma.fundTransfer.findMany({
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        created_at: 'desc'
      }
    });

    return NextResponse.json(fundTransfers);
  } catch (error) {
    console.error('Error fetching fund transfers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fund transfers' },
      { status: 500 }
    );
  }
}

// POST - Create a new fund transfer
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      trnx_id,
      organization_id,
      amount,
      status,
      receipt_url,
      transfer_date,
      transfer_time,
      description
    } = body;

    // Validate required fields
    if (!trnx_id || !organization_id || !amount || !status || !transfer_date || !transfer_time) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Check if organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: parseInt(organization_id) }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if transaction ID already exists
    const existingTransfer = await prisma.fundTransfer.findUnique({
      where: { trnx_id }
    });

    if (existingTransfer) {
      return NextResponse.json(
        { error: 'Transaction ID already exists' },
        { status: 400 }
      );
    }

    // Create the fund transfer
    const fundTransfer = await prisma.fundTransfer.create({
      data: {
        trnx_id,
        organization_id: parseInt(organization_id),
        amount: parseFloat(amount),
        status,
        receipt_url: receipt_url || null,
        transfer_date: new Date(transfer_date),
        transfer_time,
        description: description || null
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(fundTransfer, { status: 201 });
  } catch (error) {
    console.error('Error creating fund transfer:', error);
    return NextResponse.json(
      { error: 'Failed to create fund transfer' },
      { status: 500 }
    );
  }
}
