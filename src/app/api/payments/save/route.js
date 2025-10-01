import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { z } from "zod";

const savePaymentSchema = z.object({
  payment_intent_id: z.string(),
  amount: z.number().positive(),
  currency: z.string().default("USD"),
  donor_id: z.number(),
  organization_id: z.number(),
  status: z.enum(["succeeded", "failed", "pending"]),
  payment_method: z.string().default("stripe"),
  description: z.string().optional(),
});

export async function POST(request) {
  try {
    const body = await request.json();
    const validatedData = savePaymentSchema.parse(body);

    // Create payment record in database using SaveTrRecord table
    const payment = await prisma.saveTrRecord.create({
      data: {
        trx_id: `pi_${validatedData.payment_intent_id}_${Date.now()}`,
        trx_date: new Date(),
        trx_amount: validatedData.amount,
        trx_method: validatedData.payment_method,
        trx_donor_id: validatedData.donor_id,
        trx_organization_id: validatedData.organization_id,
        trx_details: JSON.stringify({
          payment_intent_id: validatedData.payment_intent_id,
          description: validatedData.description,
          currency: validatedData.currency,
          stripe_metadata: {
            payment_intent_id: validatedData.payment_intent_id,
            amount: validatedData.amount,
            currency: validatedData.currency
          }
        }),
        pay_status: validatedData.status === "succeeded" ? "completed" : "failed",
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        trx_id: payment.trx_id,
        amount: payment.trx_amount,
        status: payment.pay_status,
        payment_intent_id: validatedData.payment_intent_id,
        method: payment.trx_method,
        date: payment.trx_date,
      },
    });
  } catch (error) {
    console.error("Save payment error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid payment data", details: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to save payment" },
      { status: 500 }
    );
  }
}