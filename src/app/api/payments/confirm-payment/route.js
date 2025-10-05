import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";
import Stripe from 'stripe';

// Initialize Stripe
let stripe;
try {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn('STRIPE_SECRET_KEY environment variable is not set');
  } else {
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }
} catch (error) {
  console.error('Failed to initialize Stripe:', error);
}

// Enhanced validation schema
const confirmPaymentSchema = z.object({
  payment_intent_id: z.string().min(1, "Payment intent ID is required"),
  transaction_db_id: z.number().optional(),
  force_update: z.boolean().optional().default(false), // Allow updating already processed transactions
  retry_count: z.number().optional().default(0), // For retry logic
});

// Helper function to retry database operations
const retryDatabaseOperation = async (operation, maxRetries = 3) => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(`Database operation attempt ${attempt} failed:`, error.message);
      if (attempt === maxRetries) {
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
    }
  }
};

export async function POST(request) {
  const startTime = Date.now();
  
  try {
    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: 'Stripe not configured',
        code: 'STRIPE_NOT_CONFIGURED'
      }, { status: 503 });
    }

    const body = await request.json();
    console.log('🔍 Confirm Payment Request Body:', body);
    
    const { payment_intent_id, transaction_db_id, force_update, retry_count } = confirmPaymentSchema.parse(body);

    // Validate payment intent ID format
    if (!payment_intent_id.startsWith('pi_')) {
      return NextResponse.json({
        success: false,
        error: 'Invalid payment intent ID format',
        code: 'INVALID_PAYMENT_INTENT_FORMAT'
      }, { status: 400 });
    }

    // Find the transaction in our database with retry logic
    let transaction;
    const findTransaction = async () => {
      if (transaction_db_id) {
        // Find by database ID if provided
        return await prisma.saveTrRecord.findUnique({
          where: { id: transaction_db_id },
          select: {
            id: true,
            trx_amount: true,
            trx_donor_id: true,
            trx_organization_id: true,
            trx_details: true,
            pay_status: true,
            created_at: true,
            updated_at: true
          }
        });
      } else {
        // Find by payment intent ID in transaction details
        const whereCondition = {
          trx_details: {
            contains: payment_intent_id
          }
        };
        
        // Only look for pending transactions unless force_update is true
        if (!force_update) {
          whereCondition.pay_status = 'pending';
        }
        
        return await prisma.saveTrRecord.findFirst({
          where: whereCondition,
          select: {
            id: true,
            trx_amount: true,
            trx_donor_id: true,
            trx_organization_id: true,
            trx_details: true,
            pay_status: true,
            created_at: true,
            updated_at: true
          }
        });
      }
    };

    transaction = await retryDatabaseOperation(findTransaction);

    if (!transaction) {
      return NextResponse.json({
        success: false,
        error: 'Transaction not found',
        code: 'TRANSACTION_NOT_FOUND',
        details: force_update ? 
          'No transaction found with the provided criteria' :
          'No pending transaction found. Transaction may already be processed.'
      }, { status: 404 });
    }

    // Check if transaction is already completed and force_update is false
    if (!force_update && transaction.pay_status === 'completed') {
      return NextResponse.json({
        success: true,
        message: 'Transaction already completed',
        code: 'ALREADY_COMPLETED',
        transaction_id: transaction.id,
        payment_intent_id: payment_intent_id,
        db_status: transaction.pay_status,
        amount: transaction.trx_amount,
        warning: 'Transaction was already processed successfully'
      });
    }

    // Check payment status in Stripe with retry logic
    console.log(`🔍 Checking Stripe status for ${payment_intent_id}...`);
    
    let stripePaymentIntent;
    try {
      stripePaymentIntent = await stripe.paymentIntents.retrieve(payment_intent_id);
      console.log(`📊 Stripe status: ${stripePaymentIntent.status}`);
    } catch (stripeError) {
      console.error(`❌ Error retrieving Stripe payment intent:`, stripeError);
      
      if (stripeError.type === 'StripeInvalidRequestError') {
        return NextResponse.json({
          success: false,
          error: 'Invalid payment intent ID',
          code: 'INVALID_STRIPE_PAYMENT_INTENT',
          details: 'Payment intent not found in Stripe'
        }, { status: 404 });
      }
      
      return NextResponse.json({
        success: false,
        error: 'Failed to retrieve payment status from Stripe',
        code: 'STRIPE_RETRIEVE_ERROR',
        details: stripeError.message
      }, { status: 503 });
    }

    // Parse existing transaction details
    let parsedDetails = {};
    try {
      parsedDetails = JSON.parse(transaction.trx_details || '{}');
    } catch (e) {
      console.warn('Could not parse existing transaction details:', e.message);
      parsedDetails = {};
    }

    let updatedTransaction = null;
    let organizationUpdated = false;
    let updateReason = '';

    // Handle different Stripe payment statuses
    if (stripePaymentIntent.status === 'succeeded') {
      console.log(`✅ Payment succeeded in Stripe: $${transaction.trx_amount}`);
      
      try {
        // Use database transaction for atomicity
        const result = await prisma.$transaction(async (tx) => {
          // Update transaction to completed
          const updatedTrx = await tx.saveTrRecord.update({
            where: { id: transaction.id },
            data: {
              pay_status: 'completed',
              trx_recipt_url: stripePaymentIntent.receipt_url || `https://pay.stripe.com/receipts/${payment_intent_id}`,
              trx_details: JSON.stringify({
                ...parsedDetails,
                stripe_status: stripePaymentIntent.status,
                stripe_amount_received: stripePaymentIntent.amount_received,
                stripe_payment_method: stripePaymentIntent.payment_method,
                stripe_created: new Date(stripePaymentIntent.created * 1000),
                stripe_currency: stripePaymentIntent.currency,
                stripe_charges: stripePaymentIntent.charges?.data || [],
                confirmed_at: new Date(),
                confirmed_by: 'confirm_payment_endpoint',
                processing_time_ms: Date.now() - startTime
              }),
              updated_at: new Date()
            }
          });

          // Update organization balance
          const updatedOrg = await tx.organization.update({
            where: { id: transaction.trx_organization_id },
            data: {
              balance: {
                increment: transaction.trx_amount
              }
            },
            select: {
              id: true,
              name: true,
              balance: true
            }
          });

          return { updatedTrx, updatedOrg };
        });

        updatedTransaction = result.updatedTrx;
        organizationUpdated = true;
        updateReason = 'Payment succeeded in Stripe';
        console.log(`✅ Payment confirmed successfully: $${transaction.trx_amount}`);

      } catch (dbError) {
        console.error(`❌ Database error during payment confirmation:`, dbError);
        return NextResponse.json({
          success: false,
          error: 'Failed to update transaction in database',
          code: 'DATABASE_UPDATE_ERROR',
          details: dbError.message,
          stripe_status: stripePaymentIntent.status
        }, { status: 500 });
      }

    } else if (stripePaymentIntent.status === 'payment_failed') {
      console.log(`❌ Payment failed in Stripe`);
      
      try {
        updatedTransaction = await retryDatabaseOperation(async () => {
          return await prisma.saveTrRecord.update({
            where: { id: transaction.id },
            data: {
              pay_status: 'failed',
              trx_details: JSON.stringify({
                ...parsedDetails,
                stripe_status: stripePaymentIntent.status,
                stripe_last_payment_error: stripePaymentIntent.last_payment_error,
                stripe_failure_code: stripePaymentIntent.last_payment_error?.code,
                stripe_failure_message: stripePaymentIntent.last_payment_error?.message,
                confirmed_at: new Date(),
                confirmed_by: 'confirm_payment_endpoint',
                processing_time_ms: Date.now() - startTime
              }),
              updated_at: new Date()
            }
          });
        });

        updateReason = 'Payment failed in Stripe';
        console.log(`❌ Payment marked as failed: ${stripePaymentIntent.last_payment_error?.message || 'Unknown error'}`);

      } catch (dbError) {
        console.error(`❌ Database error during failure update:`, dbError);
        return NextResponse.json({
          success: false,
          error: 'Failed to update failed transaction in database',
          code: 'DATABASE_UPDATE_ERROR',
          details: dbError.message,
          stripe_status: stripePaymentIntent.status
        }, { status: 500 });
      }

    } else if (stripePaymentIntent.status === 'requires_payment_method') {
      console.log(`⏳ Payment requires payment method`);
      updateReason = 'Payment still requires payment method';
      
    } else if (stripePaymentIntent.status === 'requires_confirmation') {
      console.log(`⏳ Payment requires confirmation`);
      updateReason = 'Payment requires confirmation';
      
    } else if (stripePaymentIntent.status === 'requires_action') {
      console.log(`⏳ Payment requires additional action`);
      updateReason = 'Payment requires additional action';
      
    } else if (stripePaymentIntent.status === 'processing') {
      console.log(`⏳ Payment is processing`);
      updateReason = 'Payment is being processed';
      
    } else {
      console.log(`⏳ Payment status: ${stripePaymentIntent.status}`);
      updateReason = `Payment status: ${stripePaymentIntent.status}`;
    }

    // Get updated organization info
    const organization = await retryDatabaseOperation(async () => {
      return await prisma.organization.findUnique({
        where: { id: transaction.trx_organization_id },
        select: {
          id: true,
          name: true,
          balance: true
        }
      });
    });

    // Prepare comprehensive response
    const response = {
      success: true,
      payment_intent_id: payment_intent_id,
      transaction_id: transaction.id,
      stripe_status: stripePaymentIntent.status,
      db_status: updatedTransaction ? updatedTransaction.pay_status : transaction.pay_status,
      amount: transaction.trx_amount,
      currency: stripePaymentIntent.currency || 'usd',
      organization: organization,
      organization_updated: organizationUpdated,
      update_reason: updateReason,
      processing_time_ms: Date.now() - startTime,
      timestamp: new Date().toISOString(),
      retry_count: retry_count || 0
    };

    // Add appropriate message based on status
    if (stripePaymentIntent.status === 'succeeded') {
      response.message = 'Payment confirmed and completed successfully';
      response.receipt_url = stripePaymentIntent.receipt_url;
      response.payment_method = stripePaymentIntent.payment_method;
    } else if (stripePaymentIntent.status === 'payment_failed') {
      response.message = 'Payment failed';
      response.error_details = {
        code: stripePaymentIntent.last_payment_error?.code,
        message: stripePaymentIntent.last_payment_error?.message,
        type: stripePaymentIntent.last_payment_error?.type
      };
    } else {
      response.message = 'Payment status checked successfully';
      response.next_action = getNextAction(stripePaymentIntent.status);
    }

    console.log(`✅ Confirm payment completed in ${Date.now() - startTime}ms`);
    return NextResponse.json(response);

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Error confirming payment after ${processingTime}ms:`, error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: "Validation error",
        code: 'VALIDATION_ERROR',
        details: error.errors,
        processing_time_ms: processingTime
      }, { status: 400 });
    }

    // Handle specific Stripe errors
    if (error.type && error.type.startsWith('Stripe')) {
      return NextResponse.json({
        success: false,
        error: 'Stripe API error',
        code: 'STRIPE_ERROR',
        details: error.message,
        stripe_error_type: error.type,
        processing_time_ms: processingTime
      }, { status: 503 });
    }

    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      details: error.message,
      processing_time_ms: processingTime
    }, { status: 500 });
  }
}

// Helper function to determine next action based on Stripe status
function getNextAction(stripeStatus) {
  const actions = {
    'requires_payment_method': 'Complete payment with a valid payment method',
    'requires_confirmation': 'Confirm the payment',
    'requires_action': 'Complete additional authentication (3D Secure, etc.)',
    'processing': 'Wait for payment processing to complete',
    'canceled': 'Payment was canceled',
    'succeeded': 'Payment completed successfully',
    'payment_failed': 'Payment failed - try with a different payment method'
  };
  
  return actions[stripeStatus] || 'Check payment status';
}
