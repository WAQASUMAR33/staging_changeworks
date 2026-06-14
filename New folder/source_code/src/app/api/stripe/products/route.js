import { NextResponse } from "next/server";
import Stripe from 'stripe';

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

// GET /api/stripe/products - Get all Stripe products
export async function GET(request) {
  try {
    // Check if Stripe is properly initialized
    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: "Stripe service not available",
        details: "STRIPE_SECRET_KEY environment variable is not set"
      }, { status: 503 });
    }

    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active');
    const limit = parseInt(searchParams.get('limit')) || 100;
    const startingAfter = searchParams.get('starting_after');
    const endingBefore = searchParams.get('ending_before');

    // Build query parameters
    const params = {
      limit: Math.min(limit, 100), // Stripe max limit is 100
    };

    if (active !== null) {
      params.active = active === 'true';
    }

    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    if (endingBefore) {
      params.ending_before = endingBefore;
    }

    // Get all products from Stripe
    const products = await stripe.products.list(params);

    // Get prices for each product
    const productsWithPrices = await Promise.all(
      products.data.map(async (product) => {
        try {
          const prices = await stripe.prices.list({
            product: product.id,
            active: true,
            limit: 10
          });

          return {
            id: product.id,
            name: product.name,
            description: product.description,
            active: product.active,
            created: product.created,
            updated: product.updated,
            metadata: product.metadata,
            images: product.images,
            url: product.url,
            type: product.type,
            unit_label: product.unit_label,
            prices: prices.data.map(price => ({
              id: price.id,
              active: price.active,
              currency: price.currency,
              unit_amount: price.unit_amount,
              unit_amount_decimal: price.unit_amount_decimal,
              recurring: price.recurring,
              type: price.type,
              created: price.created,
              metadata: price.metadata,
              nickname: price.nickname,
              product: price.product,
              tiers: price.tiers,
              tiers_mode: price.tiers_mode,
              transform_quantity: price.transform_quantity,
              lookup_key: price.lookup_key,
              billing_scheme: price.billing_scheme,
              tax_behavior: price.tax_behavior
            }))
          };
        } catch (priceError) {
          console.error(`Error fetching prices for product ${product.id}:`, priceError);
          return {
            id: product.id,
            name: product.name,
            description: product.description,
            active: product.active,
            created: product.created,
            updated: product.updated,
            metadata: product.metadata,
            images: product.images,
            url: product.url,
            type: product.type,
            unit_label: product.unit_label,
            prices: [],
            price_error: priceError.message
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      products: productsWithPrices,
      pagination: {
        has_more: products.has_more,
        total_count: productsWithPrices.length,
        limit: params.limit
      },
      stripe_response: {
        object: products.object,
        url: products.url,
        has_more: products.has_more
      }
    });

  } catch (error) {
    console.error('Error fetching Stripe products:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch Stripe products',
      details: error.message
    }, { status: 500 });
  }
}

// POST /api/stripe/products - Create a new Stripe product
export async function POST(request) {
  try {
    // Check if Stripe is properly initialized
    if (!stripe) {
      return NextResponse.json({
        success: false,
        error: "Stripe service not available",
        details: "STRIPE_SECRET_KEY environment variable is not set"
      }, { status: 503 });
    }

    const body = await request.json();
    const {
      name,
      description,
      active = true,
      metadata = {},
      images = [],
      url,
      type = 'service',
      unit_label,
      statement_descriptor
    } = body;

    // Validate required fields
    if (!name) {
      return NextResponse.json({
        success: false,
        error: 'Product name is required'
      }, { status: 400 });
    }

    // Create product in Stripe
    const product = await stripe.products.create({
      name,
      description,
      active,
      metadata,
      images,
      url,
      type,
      unit_label,
      statement_descriptor
    });

    return NextResponse.json({
      success: true,
      product: {
        id: product.id,
        name: product.name,
        description: product.description,
        active: product.active,
        created: product.created,
        updated: product.updated,
        metadata: product.metadata,
        images: product.images,
        url: product.url,
        type: product.type,
        unit_label: product.unit_label,
        statement_descriptor: product.statement_descriptor
      },
      message: 'Product created successfully'
    });

  } catch (error) {
    console.error('Error creating Stripe product:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create Stripe product',
      details: error.message
    }, { status: 500 });
  }
}
