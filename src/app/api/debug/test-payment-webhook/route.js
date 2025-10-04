import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();
    const { payment_intent_id, donor_id, organization_id, amount } = body;

    console.log('🧪 Testing payment webhook simulation...');
    console.log('Payment Intent ID:', payment_intent_id);
    console.log('Donor ID:', donor_id);
    console.log('Organization ID:', organization_id);
    console.log('Amount:', amount);

    // Simulate the webhook processing
    const donorId = parseInt(donor_id);
    const organizationId = parseInt(organization_id);
    const amountInDollars = parseFloat(amount);

    console.log('🔍 Looking for transaction record with payment_intent_id:', payment_intent_id);

    // Find the transaction record
    const existingTransaction = await prisma.saveTrRecord.findFirst({
      where: {
        trx_details: {
          contains: payment_intent_id
        }
      }
    });

    if (!existingTransaction) {
      console.log('❌ No transaction record found');
      return NextResponse.json({
        success: false,
        error: 'No transaction record found',
        payment_intent_id
      }, { status: 404 });
    }

    console.log('✅ Found transaction record:', existingTransaction.id);

    // Update transaction record (simulate webhook success)
    const updatedTransaction = await prisma.saveTrRecord.update({
      where: {
        id: existingTransaction.id
      },
      data: {
        pay_status: 'completed',
        trx_recipt_url: 'https://pay.stripe.com/receipts/test_receipt',
        trx_details: JSON.stringify({
          payment_intent_id: payment_intent_id,
          stripe_payment_method: 'card',
          stripe_status: 'succeeded',
          stripe_amount_received: amountInDollars * 100, // Convert to cents
          stripe_created: new Date(),
          webhook_processed_at: new Date(),
          test_mode: true
        }),
        updated_at: new Date()
      }
    });

    // Update organization balance
    const updatedOrganization = await prisma.organization.update({
      where: { id: organizationId },
      data: {
        balance: {
          increment: amountInDollars
        }
      }
    });

    console.log(`✅ Updated organization ${organizationId} balance by $${amountInDollars}`);
    console.log(`✅ Updated transaction ${existingTransaction.id} to completed status`);

    return NextResponse.json({
      success: true,
      message: 'Payment webhook simulation completed successfully',
      transaction: {
        id: updatedTransaction.id,
        status: updatedTransaction.pay_status,
        amount: updatedTransaction.trx_amount
      },
      organization: {
        id: updatedOrganization.id,
        balance: updatedOrganization.balance
      }
    });

  } catch (error) {
    console.error('❌ Error in payment webhook test:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
