import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET - Fetch a specific fund transfer
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    
    const fundTransfer = await prisma.fundTransfer.findUnique({
      where: { id: parseInt(id) },
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

    if (!fundTransfer) {
      return NextResponse.json(
        { error: 'Fund transfer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(fundTransfer);
  } catch (error) {
    console.error('Error fetching fund transfer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch fund transfer' },
      { status: 500 }
    );
  }
}

// PUT - Update a fund transfer
export async function PUT(request, { params }) {
  try {
    const { id } = await params;
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

    // Check if fund transfer exists
    const existingTransfer = await prisma.fundTransfer.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingTransfer) {
      return NextResponse.json(
        { error: 'Fund transfer not found' },
        { status: 404 }
      );
    }

    // Check if new transaction ID conflicts with existing ones (excluding current)
    if (trnx_id && trnx_id !== existingTransfer.trnx_id) {
      const conflictingTransfer = await prisma.fundTransfer.findUnique({
        where: { trnx_id }
      });

      if (conflictingTransfer) {
        return NextResponse.json(
          { error: 'Transaction ID already exists' },
          { status: 400 }
        );
      }
    }

    // Update the fund transfer
    const updatedTransfer = await prisma.fundTransfer.update({
      where: { id: parseInt(id) },
      data: {
        trnx_id: trnx_id || existingTransfer.trnx_id,
        organization_id: organization_id ? parseInt(organization_id) : existingTransfer.organization_id,
        amount: amount ? parseFloat(amount) : existingTransfer.amount,
        status: status || existingTransfer.status,
        receipt_url: receipt_url !== undefined ? receipt_url : existingTransfer.receipt_url,
        transfer_date: transfer_date ? new Date(transfer_date) : existingTransfer.transfer_date,
        transfer_time: transfer_time || existingTransfer.transfer_time,
        description: description !== undefined ? description : existingTransfer.description
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

    return NextResponse.json(updatedTransfer);
  } catch (error) {
    console.error('Error updating fund transfer:', error);
    return NextResponse.json(
      { error: 'Failed to update fund transfer' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a fund transfer
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    
    // Check if fund transfer exists
    const existingTransfer = await prisma.fundTransfer.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingTransfer) {
      return NextResponse.json(
        { error: 'Fund transfer not found' },
        { status: 404 }
      );
    }

    // Delete the fund transfer
    await prisma.fundTransfer.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json(
      { message: 'Fund transfer deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting fund transfer:', error);
    return NextResponse.json(
      { error: 'Failed to delete fund transfer' },
      { status: 500 }
    );
  }
}
