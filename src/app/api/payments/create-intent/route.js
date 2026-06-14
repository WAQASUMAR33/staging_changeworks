﻿﻿﻿import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";

import { createStripeClient } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

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
  const stripe = await createStripeClient();
  try {

    // DEBUG: Identify the Platform Account (The one making the API calls)
    try {
      const platformAccount = await stripe.accounts.retrieve();
      console.log(`🔑 API Key belongs to Platform Account: ${platformAccount.id} (${platformAccount.email || 'No Email'})`);
      console.log(`ℹ️ This Account ID (${platformAccount.id}) MUST match the account for NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in the frontend.`);
    } catch (e) {
      console.error('⚠️ Could not identify Platform Account:', e.message);
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

    const destinationAccountId = organization.stripeAccountId.trim();

    // DEBUG: Check organization Stripe account status
    try {
      const stripeAcc = await stripe.accounts.retrieve(destinationAccountId);
      console.log(`🏦 Stripe Account ${destinationAccountId} status:`, {
        charges_enabled: stripeAcc.charges_enabled,
        payouts_enabled: stripeAcc.payouts_enabled,
        capabilities: stripeAcc.capabilities
      });

      if (!stripeAcc.charges_enabled && !stripeAcc.details_submitted) {
        console.warn('⚠️ Warning: Organization Stripe account has not submitted details yet.');
      }
    } catch (accErr) {
      console.error('❌ Error retrieving Stripe account status:', accErr);
      return NextResponse.json({
        success: false,
        error: "Organization Account Error",
        details: `Could not retrieve Stripe account ${destinationAccountId}. It may be invalid or not connected to this platform in the current mode. Stripe Error: ${accErr.message}`
      }, { status: 400 });
    }

    // amount is in cents (per contract)
    const amountInCents = Math.round(amount);
    const amountDollars = amountInCents / 100;

    // Determine fee strategy
    const SPECIAL_ORG_EMAIL = 'frankie@vallartacares.com';
    const isSpecialOrg = organization.email?.toLowerCase() === SPECIAL_ORG_EMAIL.toLowerCase();
    const feeStrategy = isSpecialOrg ? 'special' : 'standard';

    // Fee Formula:
    // - 90% goes to the organization
    // - 10% bucket = Stripe processing fee + platform fee
    // - application_fee = 10% − Stripe fee → org nets exactly 90%
    // Special (frankie@vallartacares.com): 0% — full amount goes to org
    let applicationFeeAmount = 0;
    if (!isSpecialOrg) {
      const platformBudget = Math.round(amountInCents * 0.10);
      const estimatedStripeFee = Math.round(amountInCents * 0.029) + 30;
      applicationFeeAmount = Math.max(0, platformBudget - estimatedStripeFee);
    }

    console.log(`💰 Total: $${amountDollars} (${amountInCents} cents)`);
    console.log(`💸 Platform Commission: ${applicationFeeAmount} cents (Strategy: ${feeStrategy})`);
    console.log(`🏦 Direct Charge to Org: ${destinationAccountId}`);

    console.log(`🏦 Initiating Direct Charge: Total=${amountInCents}, AppFee=${applicationFeeAmount} on account ${destinationAccountId}`);

    // Create payment intent with Stripe Direct Charge
    // The Connected Account is the Merchant of Record
    // The Platform takes an application fee
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        payment_method_types: ['card'],
        application_fee_amount: applicationFeeAmount,
        description: description || `Donation to ${organization.name}`,
        metadata: {
          donor_id: donor_id.toString(),
          organization_id: organization_id.toString(),
          donor_name: donor.name,
          organization_name: organization.name,
          organization_email: organization.email,
          fee_strategy: feeStrategy,
          transaction_type: 'one_time',
          ...(metadata || {}),
        },
        receipt_email: donor.email,
      }, {
        stripeAccount: destinationAccountId,
      });
    } catch (stripeError) {
      console.error('❌ Stripe Payment Intent Creation Failed:', stripeError);
      
      let errorMessage = stripeError.message;
      if (stripeError.code === 'account_invalid') {
        errorMessage = `The organization's Stripe account (${destinationAccountId}) is invalid or not connected.`;
      } else if (errorMessage.includes('Only Stripe Connect platforms can work with other accounts')) {
        errorMessage = `The Stripe secret key belongs to a Standard account, but a Connect Platform account is required. Please enable "Connect" in your Stripe Dashboard.`;
      }

      return NextResponse.json({
        success: false,
        error: "Stripe Payment Creation Failed",
        details: errorMessage,
        stripeCode: stripeError.code || stripeError.type
      }, { status: 400 });
    }

    console.log('✅ Payment Intent created successfully:', paymentIntent.id);
    console.log('ℹ️ Mode:', paymentIntent.livemode ? 'Live' : 'Test');

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
          stripe_metadata: paymentIntent.metadata,
          charge_type: 'direct_charge',
          fee_strategy: feeStrategy
        }),
        pay_status: 'pending'
      }
    });

    // Immediately check the payment status and update if already completed
    try {
      console.log(`🔍 Immediately checking payment status for ${paymentIntent.id}...`);

      // Check if payment was already completed in Stripe
      // For Direct Charges, we must retrieve from the connected account
      const currentStripePayment = await stripe.paymentIntents.retrieve(
        paymentIntent.id, 
        { stripeAccount: destinationAccountId }
      );
      console.log(`📊 Current Stripe status: ${currentStripePayment.status}`);

      if (currentStripePayment.status === 'succeeded') {
        
        // Calculate Org Amount for Balance Update
        let organizationAmountDollars;
        if (feeStrategy === 'special') {
           // Special: Total - Stripe
           const stripeFeeCents = Math.round(amountInCents * 0.029) + 30;
           organizationAmountDollars = (amountInCents - stripeFeeCents) / 100;
        } else {
           // Standard: 90% of Total
           organizationAmountDollars = amountDollars * 0.9;
        }

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
              immediately_updated_at: new Date(),
              fee_strategy: feeStrategy,
              organization_amount: organizationAmountDollars
            }),
            updated_at: new Date()
          }
        });

        // Update organization balance
        await prisma.organization.update({
          where: { id: organizationId },
          data: {
            balance: {
              increment: organizationAmountDollars
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
            // Must retrieve from the connected account for Direct Charges
            const delayedStripePayment = await stripe.paymentIntents.retrieve(
              paymentIntent.id, 
              { stripeAccount: destinationAccountId }
            );

            if (delayedStripePayment.status === 'succeeded') {
                // We leave this for the webhook to handle to avoid double counting
                console.log(`✅ Payment succeeded on delayed check!`);
            }
          } catch (e) {
            console.error('Error in delayed check:', e);
          }
        }, 5000);
      }

    } catch (immediateCheckError) {
      console.error('⚠️ Error checking immediate status:', immediateCheckError);
      // Do not fail the request, just log it
    }

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      client_secret: paymentIntent.client_secret,
      livemode: paymentIntent.livemode,
      paymentIntentId: paymentIntent.id,
      transactionId: transaction.id,
      accountId: destinationAccountId
    });

  } catch (error) {
    console.error("❌ API Error:", error);
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        success: false,
        error: "Validation Error",
        details: error.errors
      }, { status: 400 });
    }

    return NextResponse.json({
      success: false,
      error: "Internal Server Error",
      details: error.message
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
