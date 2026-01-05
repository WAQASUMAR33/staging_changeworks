import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { createOrganizationStripeProducts, createDefaultPricesForProducts } from "../../../lib/stripe-products";
import { isStripeConfigured } from "../../../../lib/stripe";

export async function POST(request) {
  try {
    const body = await request.json();
    const { organization_id } = body;

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

    // Check if products already exist
    if (organization.stripeProductId1 && organization.stripeProductId2 && organization.stripeProductId3) {
      return NextResponse.json({
        message: 'Stripe products already exist for this organization',
        stripeProductId1: organization.stripeProductId1,
        stripeProductId2: organization.stripeProductId2,
        stripeProductId3: organization.stripeProductId3
      }, { status: 200 });
    }

    console.log('🔵 Creating Stripe products for organization:', organization.id);

    // Create the 3 products
    const stripeProducts = await createOrganizationStripeProducts(organization);
    
    // Create default prices for the products
    const stripePrices = await createDefaultPricesForProducts(stripeProducts, organization);
    
    // Update organization with Stripe product IDs
    await prisma.organization.update({
      where: { id: organization.id },
      data: {
        stripeProductId1: stripeProducts.product1.id,
        stripeProductId2: stripeProducts.product2.id,
        stripeProductId3: stripeProducts.product3.id,
      }
    });
    
    console.log('✅ Stripe products created and stored successfully');
    console.log('  - Product 1 (One-Time):', stripeProducts.product1.id);
    console.log('  - Product 2 (Monthly):', stripeProducts.product2.id);
    console.log('  - Product 3 (Round-Up):', stripeProducts.product3.id);

    return NextResponse.json({
      success: true,
      message: 'Stripe products created successfully',
      stripeProductId1: stripeProducts.product1.id,
      stripeProductId2: stripeProducts.product2.id,
      stripeProductId3: stripeProducts.product3.id,
      products: {
        product1: {
          id: stripeProducts.product1.id,
          name: stripeProducts.product1.name,
          priceId: stripePrices?.price1?.id || null
        },
        product2: {
          id: stripeProducts.product2.id,
          name: stripeProducts.product2.name,
          priceId: stripePrices?.price2?.id || null
        },
        product3: {
          id: stripeProducts.product3.id,
          name: stripeProducts.product3.name,
          priceId: stripePrices?.price3?.id || null
        }
      }
    }, { status: 201 });

  } catch (error) {
    console.error('❌ Error creating Stripe products:', error);
    return NextResponse.json({
      error: 'Failed to create Stripe products',
      details: error.message
    }, { status: 500 });
  }
}



