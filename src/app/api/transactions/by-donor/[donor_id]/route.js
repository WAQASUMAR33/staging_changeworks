import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request, { params }) {
  try {
    const { donor_id } = await params;

    if (!donor_id) {
      return NextResponse.json({
        success: false,
        error: "Donor ID is required"
      }, { status: 400 });
    }

    const donorIdInt = parseInt(donor_id);
    if (isNaN(donorIdInt)) {
      return NextResponse.json({
        success: false,
        error: "Invalid donor ID format"
      }, { status: 400 });
    }

    // Verify donor exists
    const donor = await prisma.donor.findUnique({
      where: { id: donorIdInt },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true,
        organization_id: true,
        organization: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!donor) {
      return NextResponse.json({
        success: false,
        error: "Donor not found"
      }, { status: 404 });
    }

    // Get URL parameters for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // completed, pending, failed
    const method = searchParams.get('method'); // stripe, plaid
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');

    // Build where clause
    let whereClause = {
      trx_donor_id: donorIdInt
    };

    // Add filters if provided
    if (status) {
      whereClause.pay_status = status;
    }

    if (method) {
      whereClause.trx_method = method;
    }

    if (startDate || endDate) {
      whereClause.trx_date = {};
      if (startDate) {
        whereClause.trx_date.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.trx_date.lte = new Date(endDate);
      }
    }

    // Get all transactions (no pagination)
    const transactions = await prisma.saveTrRecord.findMany({
      where: whereClause,
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true
          }
        },
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

    // Format transaction data
    const formattedTransactions = transactions.map(txn => {
      let stripeDetails = null;
      try {
        if (txn.trx_details) {
          stripeDetails = JSON.parse(txn.trx_details);
        }
      } catch (e) {
        // Ignore JSON parse errors
      }

      return {
        id: txn.id,
        transaction_id: txn.trx_id,
        amount: txn.trx_amount,
        currency: 'USD', // Default currency
        method: txn.trx_method,
        status: txn.pay_status,
        receipt_url: txn.trx_recipt_url,
        transaction_date: txn.trx_date,
        created_at: txn.created_at,
        updated_at: txn.updated_at,
        ghl_id: txn.trx_ghl_id,
        donor: txn.donor,
        organization: txn.organization,
        stripe_details: stripeDetails,
        description: stripeDetails?.description || `Transaction to ${txn.organization.name}`
      };
    });

    // Calculate summary statistics
    const summary = {
      total_transactions: transactions.length,
      completed_transactions: transactions.filter(t => t.pay_status === 'completed').length,
      pending_transactions: transactions.filter(t => t.pay_status === 'pending').length,
      failed_transactions: transactions.filter(t => t.pay_status === 'failed').length,
      total_amount: transactions
        .filter(t => t.pay_status === 'completed')
        .reduce((sum, t) => sum + t.trx_amount, 0),
      stripe_transactions: transactions.filter(t => t.trx_method === 'stripe').length,
      plaid_transactions: transactions.filter(t => t.trx_method === 'plaid').length
    };

    return NextResponse.json({
      success: true,
      donor: donor,
      transactions: formattedTransactions,
      summary: summary
    });

  } catch (error) {
    console.error('Error fetching transactions by donor ID:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch transactions",
      details: error.message
    }, { status: 500 });
  }
}
