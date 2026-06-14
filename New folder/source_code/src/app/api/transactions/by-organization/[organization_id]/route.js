import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request, { params }) {
  try {
    const { organization_id } = await params;

    if (!organization_id) {
      return NextResponse.json({
        success: false,
        error: "Organization ID is required"
      }, { status: 400 });
    }

    const organizationIdInt = parseInt(organization_id);
    if (isNaN(organizationIdInt)) {
      return NextResponse.json({
        success: false,
        error: "Invalid organization ID format"
      }, { status: 400 });
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organizationIdInt },
      select: { 
        id: true, 
        name: true, 
        email: true, 
        phone: true,
        company: true,
        address: true,
        city: true,
        state: true,
        country: true,
        website: true,
        balance: true,
        status: true,
        created_at: true
      }
    });

    if (!organization) {
      return NextResponse.json({
        success: false,
        error: "Organization not found"
      }, { status: 404 });
    }

    // Get URL parameters for filtering and pagination
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const status = searchParams.get('status'); // completed, pending, failed
    const method = searchParams.get('method'); // stripe, plaid
    const startDate = searchParams.get('start_date');
    const endDate = searchParams.get('end_date');
    const donorId = searchParams.get('donor_id'); // Filter by specific donor
    
    const skip = (page - 1) * limit;

    // Build where clause
    let whereClause = {
      trx_organization_id: organizationIdInt
    };

    // Add filters if provided
    if (status) {
      whereClause.pay_status = status;
    }

    if (method) {
      whereClause.trx_method = method;
    }

    if (donorId) {
      whereClause.trx_donor_id = parseInt(donorId);
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

    // Get transactions with pagination
    const [transactions, totalCount] = await Promise.all([
      prisma.saveTrRecord.findMany({
        where: whereClause,
        skip,
        take: limit,
        include: {
          donor: {
            select: {
              id: true,
              name: true,
              email: true,
              phone: true,
              city: true,
              address: true
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
      }),
      prisma.saveTrRecord.count({
        where: whereClause
      })
    ]);

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
        payment_intent_id: stripeDetails?.payment_intent_id || null,
        description: stripeDetails?.description || `Donation from ${txn.donor.name}`,
        is_stripe_transaction: txn.trx_method === 'stripe',
        has_stripe_details: !!stripeDetails
      };
    });

    // Calculate summary statistics for this organization
    const summary = {
      total_transactions: totalCount,
      completed_transactions: transactions.filter(t => t.pay_status === 'completed').length,
      pending_transactions: transactions.filter(t => t.pay_status === 'pending').length,
      failed_transactions: transactions.filter(t => t.pay_status === 'failed').length,
      total_amount: transactions
        .filter(t => t.pay_status === 'completed')
        .reduce((sum, t) => sum + t.trx_amount, 0),
      stripe_transactions: transactions.filter(t => t.trx_method === 'stripe').length,
      plaid_transactions: transactions.filter(t => t.trx_method === 'plaid').length,
      unique_donors: [...new Set(transactions.map(t => t.trx_donor_id))].length
    };

    // Get top donors for this organization
    const topDonors = await prisma.saveTrRecord.groupBy({
      by: ['trx_donor_id'],
      where: {
        trx_organization_id: organizationIdInt,
        pay_status: 'completed'
      },
      _sum: {
        trx_amount: true
      },
      _count: {
        trx_donor_id: true
      },
      orderBy: {
        _sum: {
          trx_amount: 'desc'
        }
      },
      take: 5
    });

    // Get donor names for top donors
    const topDonorDetails = await Promise.all(
      topDonors.map(async (donor) => {
        const donorInfo = await prisma.donor.findUnique({
          where: { id: donor.trx_donor_id },
          select: { id: true, name: true, email: true }
        });
        return {
          donor: donorInfo,
          total_donated: donor._sum.trx_amount,
          transaction_count: donor._count.trx_donor_id
        };
      })
    );

    return NextResponse.json({
      success: true,
      organization: organization,
      transactions: formattedTransactions,
      pagination: {
        page: page,
        limit: limit,
        total: totalCount,
        pages: Math.ceil(totalCount / limit),
        has_next: page * limit < totalCount,
        has_prev: page > 1
      },
      summary: summary,
      top_donors: topDonorDetails,
      filters_applied: {
        status: status || 'all',
        method: method || 'all',
        donor_id: donorId || 'all',
        start_date: startDate || null,
        end_date: endDate || null
      }
    });

  } catch (error) {
    console.error('Error fetching transactions by organization ID:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch transactions",
      details: error.message
    }, { status: 500 });
  }
}
