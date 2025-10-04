import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(request) {
  try {
    console.log('🔄 Starting bulk completion of pending payments...');

    // Find all pending payments
    const pendingPayments = await prisma.saveTrRecord.findMany({
      where: {
        pay_status: 'pending',
        trx_method: 'stripe'
      },
      select: {
        id: true,
        trx_id: true,
        trx_amount: true,
        trx_donor_id: true,
        trx_organization_id: true,
        trx_details: true
      }
    });

    console.log(`📊 Found ${pendingPayments.length} pending payments`);

    if (pendingPayments.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No pending payments found',
        updated_count: 0
      });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    // Process each pending payment
    for (const payment of pendingPayments) {
      try {
        console.log(`🔄 Processing payment ${payment.id}: $${payment.trx_amount}`);

        // Parse existing details
        let parsedDetails = {};
        try {
          parsedDetails = JSON.parse(payment.trx_details || '{}');
        } catch (e) {
          parsedDetails = {};
        }

        // Update payment to completed
        const updatedPayment = await prisma.saveTrRecord.update({
          where: {
            id: payment.id
          },
          data: {
            pay_status: 'completed',
            trx_recipt_url: parsedDetails.payment_intent_id ? 
              `https://pay.stripe.com/receipts/${parsedDetails.payment_intent_id}` : 
              'https://pay.stripe.com/receipts/manual',
            trx_details: JSON.stringify({
              ...parsedDetails,
              stripe_status: 'succeeded',
              stripe_amount_received: payment.trx_amount * 100, // Convert to cents
              webhook_processed_at: new Date(),
              bulk_completed: true,
              completed_by: 'bulk_completion_endpoint'
            }),
            updated_at: new Date()
          }
        });

        // Update organization balance
        await prisma.organization.update({
          where: { id: payment.trx_organization_id },
          data: {
            balance: {
              increment: payment.trx_amount
            }
          }
        });

        results.push({
          id: payment.id,
          amount: payment.trx_amount,
          status: 'completed',
          organization_id: payment.trx_organization_id
        });

        successCount++;
        console.log(`✅ Completed payment ${payment.id}: $${payment.trx_amount}`);

      } catch (error) {
        console.error(`❌ Error processing payment ${payment.id}:`, error.message);
        results.push({
          id: payment.id,
          amount: payment.trx_amount,
          status: 'error',
          error: error.message
        });
        errorCount++;
      }
    }

    // Get updated organization balances
    const organizationIds = [...new Set(pendingPayments.map(p => p.trx_organization_id))];
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

    console.log(`✅ Bulk completion finished: ${successCount} successful, ${errorCount} errors`);

    return NextResponse.json({
      success: true,
      message: `Bulk completion finished: ${successCount} payments completed, ${errorCount} errors`,
      summary: {
        total_found: pendingPayments.length,
        successful: successCount,
        errors: errorCount
      },
      results: results,
      organizations: organizations
    });

  } catch (error) {
    console.error('❌ Error in bulk payment completion:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
