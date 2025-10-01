import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET(request, { params }) {
  try {
    const { transaction_id } = await params;

    if (!transaction_id) {
      return NextResponse.json({
        success: false,
        error: "Transaction ID is required"
      }, { status: 400 });
    }

    // Find transaction by transaction ID (trx_id field)
    const transaction = await prisma.saveTrRecord.findUnique({
      where: {
        trx_id: transaction_id
      },
      include: {
        donor: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            city: true,
            address: true,
            status: true,
            created_at: true
          }
        },
        organization: {
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
        }
      }
    });

    if (!transaction) {
      return NextResponse.json({
        success: false,
        error: "Transaction not found",
        searched_id: transaction_id
      }, { status: 404 });
    }

    // Parse Stripe details if available
    let stripeDetails = null;
    let paymentIntentId = null;
    try {
      if (transaction.trx_details) {
        stripeDetails = JSON.parse(transaction.trx_details);
        paymentIntentId = stripeDetails.payment_intent_id;
      }
    } catch (e) {
      // Ignore JSON parse errors
    }

    // Format the response
    const formattedTransaction = {
      id: transaction.id,
      transaction_id: transaction.trx_id,
      amount: transaction.trx_amount,
      currency: 'USD', // Default currency
      method: transaction.trx_method,
      status: transaction.pay_status,
      receipt_url: transaction.trx_recipt_url,
      transaction_date: transaction.trx_date,
      created_at: transaction.created_at,
      updated_at: transaction.updated_at,
      ghl_id: transaction.trx_ghl_id,
      
      // Donor information
      donor: transaction.donor,
      
      // Organization information  
      organization: transaction.organization,
      
      // Stripe-specific details
      stripe_details: stripeDetails,
      payment_intent_id: paymentIntentId,
      
      // Additional metadata
      description: stripeDetails?.description || `Transaction to ${transaction.organization.name}`,
      is_stripe_transaction: transaction.trx_method === 'stripe',
      has_stripe_details: !!stripeDetails,
      has_receipt: !!transaction.trx_recipt_url
    };

    // Get related transactions (same donor or organization)
    const relatedTransactions = await prisma.saveTrRecord.findMany({
      where: {
        OR: [
          { trx_donor_id: transaction.trx_donor_id },
          { trx_organization_id: transaction.trx_organization_id }
        ],
        NOT: {
          id: transaction.id // Exclude current transaction
        }
      },
      take: 5,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        trx_id: true,
        trx_amount: true,
        trx_method: true,
        pay_status: true,
        created_at: true
      }
    });

    return NextResponse.json({
      success: true,
      transaction: formattedTransaction,
      related_transactions: relatedTransactions,
      metadata: {
        transaction_found: true,
        is_stripe_payment: transaction.trx_method === 'stripe',
        has_stripe_metadata: !!stripeDetails,
        payment_intent_id: paymentIntentId,
        donor_id: transaction.trx_donor_id,
        organization_id: transaction.trx_organization_id
      }
    });

  } catch (error) {
    console.error('Error fetching transaction by ID:', error);
    return NextResponse.json({
      success: false,
      error: "Failed to fetch transaction",
      details: error.message,
      searched_id: params.transaction_id
    }, { status: 500 });
  }
}
