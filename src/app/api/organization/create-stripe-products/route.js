import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createStripeProductDirect, createStripePriceDirect } from "../../../lib/stripe-direct-api";
import { isStripeConfigured } from "../../../../lib/stripe";
import { corsHeaders } from '@/app/lib/cors';

export async function POST(request) {
  try {
    const body = await request.json();
    const { organization_id, products: customProducts, force = false } = body;

    if (!organization_id) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Check if Stripe is configured
    if (!isStripeConfigured()) {
      return NextResponse.json({
        error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY environment variable.'
      }, { status: 503 });
    }

    // Get organization details
    const organization = await prisma.organization.findUnique({
      where: { id: parseInt(organization_id) },
      select: {
        id: true,
        name: true,
        email: true,
        stripeAccountId: true,
        stripeProductId1: true,
        stripeProductId2: true,
        stripeProductId3: true
      }
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    if (!organization.stripeAccountId) {
      return NextResponse.json(
        { error: 'Organization does not have a connected Stripe account' },
        { status: 400 }
      );
    }

    // Check if products already exist and not forcing
    if (!force && organization.stripeProductId1 && organization.stripeProductId2 && organization.stripeProductId3) {
      return NextResponse.json({
        message: 'Stripe donation options already exist for this organization',
        stripeProductId1: organization.stripeProductId1,
        stripeProductId2: organization.stripeProductId2,
        stripeProductId3: organization.stripeProductId3
      }, { status: 200 });
    }

    console.log('Creating custom Stripe donation options for organization:', organization.id, force ? '(Forced Re-creation)' : '');

    // Default product data if not provided
    const productsToCreate = customProducts || [
      { name: 'Donation Option 1', price: 10, description: 'Donation Option 1' },
      { name: 'Donation Option 2', price: 25, description: 'Donation Option 2' },
      { name: 'Donation Option 3', price: 100, description: 'Donation Option 3' }
    ];

    const results = [];

    for (const p of productsToCreate) {
      // 1. Create Product
      const productResult = await createStripeProductDirect(
        organization.stripeAccountId,
        p.name,
        p.description || p.name
      );

      if (!productResult.success) {
        throw new Error(`Failed to create donation option "${p.name}": ${productResult.error}`);
      }

      // 2. Create Price for the Product (Monthly Subscription)
      const priceResult = await createStripePriceDirect(
        organization.stripeAccountId,
        productResult.product.id,
        p.price * 100, // Convert to cents
        'usd',
        'month'
      );

      if (!priceResult.success) {
        throw new Error(`Failed to create price for donation option "${p.name}": ${priceResult.error}`);
      }

      results.push({
        productId: productResult.product.id,
        priceId: priceResult.price.id,
        name: p.name
      });
    }

    // Update organization with Stripe product IDs
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        stripeProductId1: results[0].productId,
        stripeProductId2: results[1].productId,
        stripeProductId3: results[2].productId,
      }
    });

    console.log('✅ Custom Stripe donation options created and stored successfully');

    return NextResponse.json({
      success: true,
      message: 'Stripe donation options created successfully',
      stripeProductId1: results[0].productId,
      stripeProductId2: results[1].productId,
      stripeProductId3: results[2].productId,
      products: results
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating custom Stripe donation options:', error);
    return NextResponse.json({
      error: 'Failed to create Stripe donation options',
      details: error.message
    }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
