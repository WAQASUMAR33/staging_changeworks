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
    console.log('ðŸ” Payment Intent Request Body:', body);

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

    // Verify organization exists and has a Stripe account
    const organization = await prisma.organization.findUnique({
      where: { id: organization_id },
      select: { id: true, name: true, email: true, stripeAccountId: true }
    });

    if (!organization) {
      return NextResponse.json({
        success: false,
        error: "Invalid organization ID"
      }, { status: 400 });
    }

    if (!organization.stripeAccountId) {
      return NextResponse.json({
        success: false,
        error: "Organization Stripe account not connected",
        details: "This organization cannot receive payments yet"
      }, { status: 400 });
    }

    // DEBUG: Check organization Stripe account status
    try {
      const stripeAcc = await stripe.accounts.retrieve(organization.stripeAccountId);
      console.log(`ðŸ¦ Stripe Account ${organization.stripeAccountId} status:`, {
        charges_enabled: stripeAcc.charges_enabled,
        payouts_enabled: stripeAcc.payouts_enabled,
        capabilities: stripeAcc.capabilities
      });

      if (!stripeAcc.charges_enabled && !stripeAcc.details_submitted) {
        console.warn('âš ï¸ Warning: Organization Stripe account has not submitted details yet.');
      }
    } catch (accErr) {
      console.error('âŒ Error retrieving Stripe account status:', accErr);
    }

    // amount is in cents (per contract)
    const amountInCents = Math.round(amount);
    const amountDollars = amountInCents / 100;

    // Calculate 90% for the organization transfer
    const transferAmountCents = Math.round(amountInCents * 0.90);
    const applicationFeeAmount = amountInCents - transferAmountCents;

    console.log(`ðŸ’° Total: $${amountDollars} (${amountInCents} cents)`);
    console.log(`ðŸ’¸ Platform Commission (10%): ${amountInCents - transferAmountCents} cents`);
    console.log(`ðŸ¦ Transfer to Org (90%): ${transferAmountCents} cents to ${organization.stripeAccountId}`);

    console.log(`ðŸ¦ Initiating Destination Charge: Total=${amountInCents}, Transfer=${transferAmountCents} to ${organization.stripeAccountId}`);

    // Create payment intent with Stripe Destination Charge
    // ChangeWorks processes the full amount, then transfers 90% to the organization automatically
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
      transfer_data: {
        amount: transferAmountCents,
        destination: organization.stripeAccountId,
      },
    });

    console.log('âœ… Payment Intent created successfully:', paymentIntent.id);

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
          platform_fee_cents: applicationFeeAmount,
          destination_account: organization.stripeAccountId,
          stripe_metadata: paymentIntent.metadata
        }),
        pay_status: 'pending'
      }
    });

    // Immediately check the payment status and update if already completed
    try {
      console.log(`ðŸ” Immediately checking payment status for ${paymentIntent.id}...`);

      // Check if payment was already completed in Stripe
      const currentStripePayment = await stripe.paymentIntents.retrieve(paymentIntent.id);
      console.log(`ðŸ“Š Current Stripe status: ${currentStripePayment.status}`);

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

        // Update organization balance with 90% of the amount in dollars
        await prisma.organization.update({
          where: { id: organization_id },
          data: {
            balance: {
              increment: amountDollars * 0.9
            }
          }
        });

        console.log(`âœ… Immediately updated payment ${paymentIntent.id} to completed status`);
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

        console.log(`âŒ Immediately updated payment ${paymentIntent.id} to failed status`);
      } else {
        console.log(`â³ Payment ${paymentIntent.id} still pending: ${currentStripePayment.status}`);

        // Set up additional checking for payments that are still pending
        setTimeout(async () => {
          try {
            console.log(`ðŸ”„ Delayed check for payment ${paymentIntent.id}...`);
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

              // Update organization balance with 90% of the amount in dollars
              await prisma.organization.update({
                where: { id: organization_id },
                data: {
                  balance: {
                    increment: (delayedStripePayment.amount_received / 100) * 0.9
                  }
                }
              });

              console.log(`âœ… Delayed update: Payment ${paymentIntent.id} completed`);
            }
          } catch (error) {
            console.error(`âŒ Error in delayed check for payment ${paymentIntent.id}:`, error);
          }
        }, 15000); // 15 seconds delay for additional check
      }
    } catch (error) {
      console.error(`âŒ Error immediately checking payment ${paymentIntent.id}:`, error);
    }

    return NextResponse.json({
      success: true,
      client_secret: paymentIntent.client_secret,
      payment_intent_id: paymentIntent.id
    });

  } catch (error) {
    console.error('âŒ Error creating payment intent:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: "Validation error",
        details: error.errors
      }, { status: 400 });
    }

    if (error.type === 'StripeError' || error.type === 'StripeInvalidRequestError') {
      return NextResponse.json({
        success: false,
        error: "Stripe Error",
        details: error.message,
        stripeCode: error.code || error.type
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: "Failed to create payment intent",
      details: error.message,
      stripeCode: error.code || error.type
    }, { status: 500 });
  }
}
