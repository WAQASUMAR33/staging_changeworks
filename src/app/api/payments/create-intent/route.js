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
// NOTE: amount is expected in CENTS per latest contract
const paymentIntentSchema = z.object({
  amount: z.number().int().positive("Amount (in cents) must be positive"),
  currency: z.string().min(3).max(3).default("USD"),
  donor_id: z.number().int().positive("Donor ID is required"),
  organization_id: z.number().int().positive("Organization ID is required"),
  description: z.string().optional(),
  metadata: z.record(z.any()).optional(),
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
    
    const { amount, currency, donor_id, organization_id, description, metadata } = paymentIntentSchema.parse(body);

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

    // amount is in cents (per contract)
    const amountInCents = Math.round(amount);
    const amountDollars = amountInCents / 100;
    console.log(`💰 Payment amount: $${amountDollars} = ${amountInCents} cents`);

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
        ...(metadata || {}),
      },
      receipt_email: donor.email,
    });

    // Create a pending transaction record in the database
    const transactionId = `pi_${paymentIntent.id}_${Date.now()}`;
    
    const transaction = await prisma.saveTrRecord.create({
      data: {
        trx_id: transactionId,
        trx_date: new Date(),
        trx_amount: amountDollars, // store in dollars
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

    // Immediately check the payment status and update if already completed
    try {
      console.log(`🔍 Immediately checking payment status for ${paymentIntent.id}...`);
      
      // Check if payment was already completed in Stripe
      const currentStripePayment = await stripe.paymentIntents.retrieve(paymentIntent.id);
      console.log(`📊 Current Stripe status: ${currentStripePayment.status}`);
      
      if (currentStripePayment.status === 'succeeded') {
        // Payment already succeeded, update to completed immediately
        await prisma.saveTrRecord.update({
          where: { id: transaction.id },
          data: {
            pay_status: 'completed',
            trx_recipt_url: currentStripePayment.receipt_url || `https://pay.stripe.com/receipts/${paymentIntent.id}`,
            trx_details: JSON.stringify({
              payment_intent_id: paymentIntent.id,
              description: description || `Donation to ${organization.name}`,
              stripe_metadata: paymentIntent.metadata,
              stripe_status: currentStripePayment.status,
              stripe_amount_received: currentStripePayment.amount_received,
              stripe_payment_method: currentStripePayment.payment_method,
              stripe_created: new Date(currentStripePayment.created * 1000),
              immediately_updated_at: new Date()
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

        console.log(`✅ Immediately updated payment ${paymentIntent.id} to completed status`);
      } else if (currentStripePayment.status === 'payment_failed') {
        // Payment failed, update to failed immediately
        await prisma.saveTrRecord.update({
          where: { id: transaction.id },
          data: {
            pay_status: 'failed',
            trx_details: JSON.stringify({
              payment_intent_id: paymentIntent.id,
              description: description || `Donation to ${organization.name}`,
              stripe_metadata: paymentIntent.metadata,
              stripe_status: currentStripePayment.status,
              stripe_last_payment_error: currentStripePayment.last_payment_error,
              immediately_updated_at: new Date()
            }),
            updated_at: new Date()
          }
        });

        console.log(`❌ Immediately updated payment ${paymentIntent.id} to failed status`);
      } else {
        console.log(`⏳ Payment ${paymentIntent.id} still pending: ${currentStripePayment.status}`);
        
        // Set up additional checking for payments that are still pending
        setTimeout(async () => {
          try {
            console.log(`🔄 Delayed check for payment ${paymentIntent.id}...`);
            const delayedStripePayment = await stripe.paymentIntents.retrieve(paymentIntent.id);
            
            if (delayedStripePayment.status === 'succeeded') {
              await prisma.saveTrRecord.update({
                where: { id: transaction.id },
                data: {
                  pay_status: 'completed',
                  trx_recipt_url: delayedStripePayment.receipt_url || `https://pay.stripe.com/receipts/${paymentIntent.id}`,
                  trx_details: JSON.stringify({
                    payment_intent_id: paymentIntent.id,
                    description: description || `Donation to ${organization.name}`,
                    stripe_metadata: paymentIntent.metadata,
                    stripe_status: delayedStripePayment.status,
                    stripe_amount_received: delayedStripePayment.amount_received,
                    stripe_payment_method: delayedStripePayment.payment_method,
                    stripe_created: new Date(delayedStripePayment.created * 1000),
                    delayed_updated_at: new Date()
                  }),
                  updated_at: new Date()
                }
              });

              await prisma.organization.update({
                where: { id: organization_id },
                data: {
                  balance: {
                    increment: amount
                  }
                }
              });

              console.log(`✅ Delayed update: Payment ${paymentIntent.id} completed`);
            }
          } catch (error) {
            console.error(`❌ Error in delayed check for payment ${paymentIntent.id}:`, error);
          }
        }, 15000); // 15 seconds delay for additional check
      }
    } catch (error) {
      console.error(`❌ Error immediately checking payment ${paymentIntent.id}:`, error);
    }

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
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
