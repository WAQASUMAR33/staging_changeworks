import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "../../../lib/prisma";

import { createStripeClient } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

// Validation schema
// amount is expected in cents
const schema = z.object({
  ghlid: z.string().min(1, "ghlid is required"),
  amount: z.number().int().positive("Amount (in cents) must be a positive integer"),
  email: z.string().email("Valid email is required"),
  product_id: z.string().min(1, "product_id is required"),
});

export async function POST(request) {
  const stripe = await createStripeClient();
  try {
    if (!stripe) {
      return NextResponse.json(
        { success: false, error: "Payment service not available", details: "Stripe configuration is missing" },
        { status: 503 }
      );
    }

    const body = await request.json();
    console.log("🔍 One-Time Post Payment Request:", body);

    const { ghlid, amount, email, product_id } = schema.parse(body);

    // Look up organization by ghlId
    const organization = await prisma.organization.findFirst({
      where: { ghlId: ghlid },
      select: { id: true, name: true, email: true, stripeAccountId: true },
    });

    if (!organization) {
      return NextResponse.json(
        { success: false, error: "Organization not found", details: `No organization found for ghlid: ${ghlid}` },
        { status: 404 }
      );
    }

    if (!organization.stripeAccountId) {
      return NextResponse.json(
        {
          success: false,
          error: "Organization Stripe account not connected",
          details: "This organization cannot receive payments yet",
        },
        { status: 400 }
      );
    }

    const destinationAccountId = organization.stripeAccountId.trim();
    const amountInCents = Math.round(amount);
    const amountDollars = amountInCents / 100;

    // Fee Formula:
    // - 90% goes to the organization
    // - 10% bucket = Stripe processing fee + platform fee
    // - application_fee = 10% − Stripe fee → org nets exactly 90%
    // Special (frankie@vallartacares.com): 0% — full amount goes to org
    const SPECIAL_ORG_EMAIL = "frankie@vallartacares.com";
    const isSpecialOrg = organization.email?.toLowerCase() === SPECIAL_ORG_EMAIL.toLowerCase();
    const feeStrategy = isSpecialOrg ? "special" : "standard";
    let applicationFeeAmount = 0;
    if (!isSpecialOrg) {
      const platformBudget = Math.round(amountInCents * 0.10);
      const estimatedStripeFee = Math.round(amountInCents * 0.029) + 30;
      applicationFeeAmount = Math.max(0, platformBudget - estimatedStripeFee);
    }

    console.log(`💰 Total: $${amountDollars} (${amountInCents} cents)`);
    console.log(`💸 Platform Fee: ${applicationFeeAmount} cents (Strategy: ${feeStrategy})`);
    console.log(`🏦 Charging to Stripe Account: ${destinationAccountId}`);

    // Create Stripe PaymentIntent as a direct charge on the connected account
    let paymentIntent;
    try {
      paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: "usd",
          payment_method_types: ["card"],
          application_fee_amount: applicationFeeAmount,
          description: `One-time payment to ${organization.name}`,
          receipt_email: email,
          metadata: {
            ghlid,
            product_id,
            payer_email: email,
            organization_id: organization.id.toString(),
            organization_name: organization.name,
            organization_email: organization.email,
            fee_strategy: feeStrategy,
            transaction_type: "one_time_post",
          },
        },
        {
          stripeAccount: destinationAccountId,
        }
      );
    } catch (stripeError) {
      console.error("❌ Stripe PaymentIntent creation failed:", stripeError);

      let errorMessage = stripeError.message;
      if (stripeError.code === "account_invalid") {
        errorMessage = `The organization's Stripe account (${destinationAccountId}) is invalid or not connected.`;
      }

      return NextResponse.json(
        {
          success: false,
          error: "Stripe Payment Creation Failed",
          details: errorMessage,
          stripeCode: stripeError.code || stripeError.type,
        },
        { status: 400 }
      );
    }

    console.log("✅ PaymentIntent created:", paymentIntent.id);

    return NextResponse.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      accountId: destinationAccountId,
      organization: {
        id: organization.id,
        name: organization.name,
      },
      amount: {
        total_cents: amountInCents,
        total_dollars: amountDollars,
        platform_fee_cents: applicationFeeAmount,
      },
    });
  } catch (error) {
    console.error("❌ API Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation Error", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: "Internal Server Error", details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
