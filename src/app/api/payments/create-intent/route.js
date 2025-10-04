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

    // Amount is already in cents from frontend, use as-is
    const amountInCents = Math.round(amount);
    console.log(`💰 Payment amount: ${amount} cents = $${amount / 100}`);

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
    
    await prisma.saveTrRecord.create({
      data: {
        trx_id: transactionId,
        trx_date: new Date(),
        trx_amount: amount / 100, // Convert cents back to dollars for storage
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

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id,
      amount: amount,
      currency: currency,
      transaction_id: transactionId,
      message: "Payment intent created successfully"
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
