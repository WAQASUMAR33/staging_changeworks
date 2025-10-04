import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET(request) {
  try {
    console.log('🔍 Checking recent transactions...');

    // Get recent transactions
    const transactions = await prisma.saveTrRecord.findMany({
      orderBy: {
        created_at: 'desc'
      },
      take: 10,
      select: {
        id: true,
        trx_id: true,
        trx_amount: true,
        pay_status: true,
        trx_method: true,
        trx_donor_id: true,
        trx_organization_id: true,
        created_at: true,
        updated_at: true,
        trx_details: true
      }
    });

    console.log(`📊 Found ${transactions.length} recent transactions`);

    // Parse transaction details
    const transactionsWithDetails = transactions.map(transaction => {
      let parsedDetails = {};
      try {
        parsedDetails = JSON.parse(transaction.trx_details || '{}');
      } catch (e) {
        parsedDetails = { error: 'Failed to parse details' };
      }

      return {
        ...transaction,
        parsed_details: parsedDetails
      };
    });

    // Get organization info
    const organizationIds = [...new Set(transactions.map(t => t.trx_organization_id))];
    const organizations = await prisma.organization.findMany({
      where: {
        id: { in: organizationIds }
      },
      select: {
        id: true,
        name: true,
        balance: true
      }
    });

    const orgMap = organizations.reduce((acc, org) => {
      acc[org.id] = org;
      return acc;
    }, {});

    return NextResponse.json({
      success: true,
      message: 'Recent transactions retrieved successfully',
      count: transactions.length,
      transactions: transactionsWithDetails,
      organizations: orgMap,
      summary: {
        total_transactions: transactions.length,
        pending_count: transactions.filter(t => t.pay_status === 'pending').length,
        completed_count: transactions.filter(t => t.pay_status === 'completed').length,
        failed_count: transactions.filter(t => t.pay_status === 'failed').length
      }
    });

  } catch (error) {
    console.error('❌ Error checking transactions:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
