import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET() {
  try {
    console.log('🔍 Checking Stripe transactions in database...');

    // Check for transactions with Stripe payment method
    const stripeTransactions = await prisma.saveTrRecord.findMany({
      where: {
        trx_method: 'stripe'
      },
      include: {
        donor: { 
          select: { id: true, name: true, email: true } 
        },
        organization: { 
          select: { id: true, name: true, email: true } 
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10 // Get last 10 transactions
    });

    // Check for transactions with Stripe payment intent IDs in details
    const stripePaymentIntentTransactions = await prisma.saveTrRecord.findMany({
      where: {
        trx_details: {
          contains: 'payment_intent_id'
        }
      },
      include: {
        donor: { 
          select: { id: true, name: true, email: true } 
        },
        organization: { 
          select: { id: true, name: true, email: true } 
        }
      },
      orderBy: {
        created_at: 'desc'
      },
      take: 10
    });

    // Get total counts
    const [
      totalStripeTransactions,
      totalPaymentIntentTransactions,
      totalTransactions,
      completedStripeTransactions,
      pendingStripeTransactions
    ] = await Promise.all([
      prisma.saveTrRecord.count({
        where: { trx_method: 'stripe' }
      }),
      prisma.saveTrRecord.count({
        where: {
          trx_details: {
            contains: 'payment_intent_id'
          }
        }
      }),
      prisma.saveTrRecord.count(),
      prisma.saveTrRecord.count({
        where: {
          trx_method: 'stripe',
          pay_status: 'completed'
        }
      }),
      prisma.saveTrRecord.count({
        where: {
          trx_method: 'stripe',
          pay_status: 'pending'
        }
      })
    ]);

    // Format transaction details
    const formattedTransactions = stripeTransactions.map(txn => {
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
        status: txn.pay_status,
        method: txn.trx_method,
        date: txn.trx_date,
        created_at: txn.created_at,
        donor: txn.donor,
        organization: txn.organization,
        has_stripe_details: !!stripeDetails,
        stripe_payment_intent_id: stripeDetails?.payment_intent_id || null,
        stripe_status: stripeDetails?.stripe_status || null
      };
    });

    const hasStripeTransactions = totalStripeTransactions > 0 || totalPaymentIntentTransactions > 0;

    return NextResponse.json({
      success: true,
      message: hasStripeTransactions 
        ? `Found ${totalStripeTransactions} Stripe transactions in database`
        : "No Stripe transactions found in database",
      stripe_transactions_found: hasStripeTransactions,
      summary: {
        total_stripe_transactions: totalStripeTransactions,
        total_payment_intent_transactions: totalPaymentIntentTransactions,
        total_all_transactions: totalTransactions,
        completed_stripe: completedStripeTransactions,
        pending_stripe: pendingStripeTransactions
      },
      recent_stripe_transactions: formattedTransactions,
      database_tables_checked: [
        "saveTrRecord (main transactions table)",
        "donor (transaction relationships)", 
        "organization (transaction relationships)"
      ],
      search_criteria: [
        "trx_method = 'stripe'",
        "trx_details contains 'payment_intent_id'"
      ]
    });

  } catch (error) {
    console.error('❌ Error checking Stripe transactions:', error);
    
    return NextResponse.json({
      success: false,
      error: "Failed to check Stripe transactions",
      details: error.message,
      suggestions: [
        "Check if database is connected",
        "Verify saveTrRecord table exists",
        "Run 'npx prisma generate' if needed",
        "Check if any Stripe payments have been made"
      ]
    }, { status: 500 });
  }
}
