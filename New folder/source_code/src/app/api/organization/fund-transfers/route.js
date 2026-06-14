import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request) {
  try {
    // Get organization ID from query params
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    
    if (!organizationId) {
      return NextResponse.json({
        success: false,
        error: 'Organization ID is required'
      }, { status: 400 });
    }

    const orgId = parseInt(organizationId);
    
    if (isNaN(orgId)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid organization ID'
      }, { status: 400 });
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true, email: true }
    });

    if (!organization) {
      return NextResponse.json({
        success: false,
        error: 'Organization not found'
      }, { status: 404 });
    }

    // Get fund transfers for this organization
    const fundTransfers = await prisma.fundTransfer.findMany({
      where: {
        organization_id: orgId
      },
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

    // Calculate summary statistics
    const summary = {
      total_transfers: fundTransfers.length,
      completed_transfers: fundTransfers.filter(t => t.status === 'completed').length,
      pending_transfers: fundTransfers.filter(t => t.status === 'pending').length,
      failed_transfers: fundTransfers.filter(t => t.status === 'failed').length,
      total_amount: fundTransfers
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + t.amount, 0),
      pending_amount: fundTransfers
        .filter(t => t.status === 'pending')
        .reduce((sum, t) => sum + t.amount, 0)
    };

    return NextResponse.json({
      success: true,
      organization: organization,
      transfers: fundTransfers,
      summary: summary
    });

  } catch (error) {
    console.error('Error fetching organization fund transfers:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch fund transfers',
      details: error.message
    }, { status: 500 });
  }
}
