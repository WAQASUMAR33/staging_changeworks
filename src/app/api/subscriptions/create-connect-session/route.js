import { NextResponse } from "next/server";
import { createStripeClient } from '@/app/lib/payment-mode';
import { prisma } from "../../../lib/prisma";
import { corsHeaders } from '@/app/lib/cors';


export async function POST(request) {
    try {
        const body = await request.json();
        const {
            donor_id,
            product_id,
            price_id,
            organization_id
        } = body;

        // Validate required fields
        if (!donor_id || !product_id || !price_id || !organization_id) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields: donor_id, product_id, price_id, organization_id' },
                { status: 400 }
            );
        }

        // Get donor details
        const donor = await prisma.donor.findUnique({
            where: { id: donor_id },
            select: { id: true, name: true, email: true }
        });

        if (!donor) {
            return NextResponse.json(
                { success: false, error: 'Donor not found' },
                { status: 404 }
            );
        }

        // Get organization details
        const organization = await prisma.organization.findUnique({
            where: { id: organization_id },
            select: { id: true, name: true, email: true, stripeAccountId: true }
        });

        if (!organization || !organization.stripeAccountId) {
            return NextResponse.json(
                { success: false, error: 'Organization not found or Stripe account not connected' },
                { status: 404 }
            );
        }

        const stripe = await createStripeClient();

        // Determine base URL
        const requestUrl = new URL(request.url);
        const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`;

        // Create or retrieve Stripe customer ON THE CONNECTED ACCOUNT
        let customer;
        try {
            const existingCustomers = await stripe.customers.list({
                email: donor.email,
                limit: 1
            }, {
                stripeAccount: organization.stripeAccountId
            });

            if (existingCustomers.data.length > 0) {
                customer = existingCustomers.data[0];
            } else {
                customer = await stripe.customers.create({
                    email: donor.email,
                    name: donor.name,
                    metadata: {
                        donor_id: donor_id.toString(),
                        organization_id: organization_id.toString()
                    }
                }, {
                    stripeAccount: organization.stripeAccountId
                });
            }
        } catch (stripeError) {
            console.error('Stripe customer creation error on connected account:', stripeError);
            return NextResponse.json(
                { success: false, error: 'Failed to create Stripe customer on connected account' },
                { status: 500 }
            );
        }

        // Fee Formula:
        // - 90% goes to the organization
        // - 10% bucket = Stripe processing fee (~2.9%) + platform fee (~7.1%)
        // - application_fee_percent = 7.1% (10% − 2.9%) → org nets ~90% after Stripe's fixed 30¢
        // Special (frankie@vallartacares.com): 0% — full amount goes to org
        const SPECIAL_ORG_EMAIL = 'frankie@vallartacares.com';
        const isSpecialOrg = organization.email?.toLowerCase() === SPECIAL_ORG_EMAIL.toLowerCase();
        const applicationFeePercent = isSpecialOrg ? 0 : 7.1;

        // Create Stripe checkout session for subscription on connected account
        try {
            const checkoutSession = await stripe.checkout.sessions.create({
                customer: customer.id,
                payment_method_types: ['card'],
                line_items: [
                    {
                        price: price_id,
                        quantity: 1,
                    },
                ],
                mode: 'subscription',
                subscription_data: {
                    application_fee_percent: applicationFeePercent,
                    metadata: {
                        donor_id: donor_id.toString(),
                        organization_id: organization_id.toString(),
                        product_id: product_id,
                        price_id: price_id
                    }
                },
                success_url: `${baseUrl.replace(/\/$/, '')}/donor/subscription-success?session_id={CHECKOUT_SESSION_ID}&org_id=${organization_id}`,
                cancel_url: `${baseUrl.replace(/\/$/, '')}/donor/subscribe?subscription=cancelled`,
                metadata: {
                    donor_id: donor_id.toString(),
                    organization_id: organization_id.toString(),
                    product_id: product_id,
                    price_id: price_id
                }
            }, {
                stripeAccount: organization.stripeAccountId
            });

            return NextResponse.json({
                success: true,
                checkout_url: checkoutSession.url,
                session_id: checkoutSession.id,
                message: 'Checkout session created successfully'
            });

        } catch (stripeError) {
            console.error('Stripe checkout session creation error on connected account:', stripeError);
            return NextResponse.json(
                { success: false, error: 'Failed to create checkout session' },
                { status: 500 }
            );
        }

    } catch (error) {
        console.error('Subscription creation error:', error);
        return NextResponse.json(
            { success: false, error: 'Internal server error' },
            { status: 500 }
        );
    }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
