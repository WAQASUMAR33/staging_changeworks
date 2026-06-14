import { NextResponse } from "next/server";
import { getStripeAccountOnboardingLink } from "../../../lib/stripe-connect";
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  try {
    const body = await request.json();
    const { stripeAccountId } = body;

    if (!stripeAccountId) {
      return NextResponse.json({
        success: false,
        error: 'Stripe Account ID is required'
      }, { status: 400 });
    }

    const url = await getStripeAccountOnboardingLink(stripeAccountId);

    return NextResponse.json({
      success: true,
      url
    });

  } catch (error) {
    console.error('Error generating onboarding link:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to generate onboarding link'
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
