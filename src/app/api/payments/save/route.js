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

    // Create payment record in database
    const payment = await prisma.donorTransaction.create({
      data: {
        donor_id: validatedData.donor_id,
        organization_id: validatedData.organization_id,
        amount: validatedData.amount,
        currency: validatedData.currency,
        status: validatedData.status === "succeeded" ? "completed" : "failed",
        payment_method: validatedData.payment_method,
        stripe_payment_intent_id: validatedData.payment_intent_id,
        description: validatedData.description,
        created_at: new Date(),
        updated_at: new Date(),
      },
    });

    return NextResponse.json({
      success: true,
      payment: {
        id: payment.id,
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        payment_intent_id: validatedData.payment_intent_id,
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