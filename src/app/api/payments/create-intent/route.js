import { NextResponse } from "next/server";
import { z } from "zod";
import Stripe from 'stripe';
import { prisma } from "../../../lib/prisma";

// Initialize Stripe with proper error handling
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

// Validation schema for payment intent creation
const paymentIntentSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  currency: z.string().min(3).max(3).default("USD"),
  donor_id: z.number().int().positive("Donor ID is required"),
  organization_id: z.number().int().positive("Organization ID is required"),
  description: z.string().optional(),
});

export async function POST(request) {
  try {
    // Check if Stripe is properly initialized
    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: "Payment service not available",
        details: "Stripe configuration is missing"
      }, { status: 503 });
    }

    const body = await request.json();
    console.log('🔍 Payment Intent Request Body:', body);
    
    const { amount, currency, donor_id, organization_id, description } = paymentIntentSchema.parse(body);

    // Verify donor exists
    const donor = await prisma.donor.findUnique({
      where: { id: donor_id },
      select: { id: true, name: true, email: true }
    });
    
    if (!donor) {
      return NextResponse.json({
        success: false,
        error: "Invalid donor ID"
      }, { status: 400 });
    }

    // Verify organization exists
    const organization = await prisma.organization.findUnique({
      where: { id: organization_id },
      select: { id: true, name: true, email: true }
    });
    
    if (!organization) {
      return NextResponse.json({
        success: false,
        error: "Invalid organization ID"
      }, { status: 400 });
    }

    // Convert dollars to cents for Stripe
    const amountInCents = Math.round(amount * 100);
    console.log(`💰 Payment amount: $${amount} = ${amountInCents} cents`);

    // Create payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: currency.toLowerCase(),
      payment_method_types: ['card'],
      description: description || `Donation to ${organization.name}`,
      metadata: {
        donor_id: donor_id.toString(),
        organization_id: organization_id.toString(),
        donor_name: donor.name,
        organization_name: organization.name,
      },
      receipt_email: donor.email,
    });

    // Create a pending transaction record in the database
    const transactionId = `pi_${paymentIntent.id}_${Date.now()}`;
    
    const transaction = await prisma.saveTrRecord.create({
      data: {
        trx_id: transactionId,
        trx_date: new Date(),
        trx_amount: amount, // Store in dollars (amount is already in dollars)
        trx_method: 'stripe',
        trx_donor_id: donor_id,
        trx_organization_id: organization_id,
        trx_details: JSON.stringify({
          payment_intent_id: paymentIntent.id,
          description: description || `Donation to ${organization.name}`,
          stripe_metadata: paymentIntent.metadata
        }),
        pay_status: 'pending'
      }
    });

    // Automatically check and update payment status after a short delay
    // This simulates the webhook behavior
    setTimeout(async () => {
      try {
        console.log(`🔄 Auto-checking payment status for ${paymentIntent.id}...`);
        
        // Check if payment was completed in Stripe
        const updatedStripePayment = await stripe.paymentIntents.retrieve(paymentIntent.id);
        
        if (updatedStripePayment.status === 'succeeded') {
          // Update database to completed
          await prisma.saveTrRecord.update({
            where: { id: transaction.id },
            data: {
              pay_status: 'completed',
              trx_recipt_url: updatedStripePayment.receipt_url || `https://pay.stripe.com/receipts/${paymentIntent.id}`,
              trx_details: JSON.stringify({
                payment_intent_id: paymentIntent.id,
                description: description || `Donation to ${organization.name}`,
                stripe_metadata: paymentIntent.metadata,
                stripe_status: updatedStripePayment.status,
                stripe_amount_received: updatedStripePayment.amount_received,
                stripe_payment_method: updatedStripePayment.payment_method,
                stripe_created: new Date(updatedStripePayment.created * 1000),
                auto_updated_at: new Date()
              }),
              updated_at: new Date()
            }
          });

          // Update organization balance
          await prisma.organization.update({
            where: { id: organization_id },
            data: {
              balance: {
                increment: amount
              }
            }
          });

          console.log(`✅ Auto-updated payment ${paymentIntent.id} to completed status`);
        } else if (updatedStripePayment.status === 'payment_failed') {
          // Update to failed status
          await prisma.saveTrRecord.update({
            where: { id: transaction.id },
            data: {
              pay_status: 'failed',
              trx_details: JSON.stringify({
                payment_intent_id: paymentIntent.id,
                description: description || `Donation to ${organization.name}`,
                stripe_metadata: paymentIntent.metadata,
                stripe_status: updatedStripePayment.status,
                stripe_last_payment_error: updatedStripePayment.last_payment_error,
                auto_updated_at: new Date()
              }),
              updated_at: new Date()
            }
          });

          console.log(`❌ Auto-updated payment ${paymentIntent.id} to failed status`);
        }
      } catch (error) {
        console.error(`❌ Error auto-updating payment ${paymentIntent.id}:`, error);
      }
    }, 10000); // 10 seconds delay to allow payment completion

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: amount,
      currency: currency,
      transaction_id: transactionId,
      transaction_db_id: transaction.id,
      message: "Payment intent created successfully with auto-status checking enabled",
      auto_check_note: "Payment status will be automatically checked and updated after completion"
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: "Validation error",
        details: error.errors
      }, { status: 400 });
    }

    if (error.type === 'StripeError') {
      return NextResponse.json({
        success: false,
        error: "Payment processing error",
        details: error.message
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: "Failed to create payment intent",
      details: error.message
    }, { status: 500 });
  }
}
