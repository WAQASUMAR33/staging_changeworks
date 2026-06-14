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

// GET /api/stripe/prices - Get all Stripe prices
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
    const product = searchParams.get('product');
    const currency = searchParams.get('currency');
    const type = searchParams.get('type'); // 'one_time' or 'recurring'
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

    if (product) {
      params.product = product;
    }

    if (currency) {
      params.currency = currency;
    }

    if (type) {
      params.type = type;
    }

    if (startingAfter) {
      params.starting_after = startingAfter;
    }

    if (endingBefore) {
      params.ending_before = endingBefore;
    }

    // Get all prices from Stripe
    const prices = await stripe.prices.list(params);

    // Get product details for each price
    const pricesWithProducts = await Promise.all(
      prices.data.map(async (price) => {
        try {
          let productDetails = null;
          if (price.product) {
            const product = await stripe.products.retrieve(price.product);
            productDetails = {
              id: product.id,
              name: product.name,
              description: product.description,
              active: product.active,
              images: product.images,
              metadata: product.metadata
            };
          }

          return {
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
            tax_behavior: price.tax_behavior,
            product_details: productDetails
          };
        } catch (productError) {
          console.error(`Error fetching product for price ${price.id}:`, productError);
          return {
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
            tax_behavior: price.tax_behavior,
            product_details: null,
            product_error: productError.message
          };
        }
      })
    );

    return NextResponse.json({
      success: true,
      prices: pricesWithProducts,
      pagination: {
        has_more: prices.has_more,
        total_count: pricesWithProducts.length,
        limit: params.limit
      },
      stripe_response: {
        object: prices.object,
        url: prices.url,
        has_more: prices.has_more
      }
    });

  } catch (error) {
    console.error('Error fetching Stripe prices:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch Stripe prices',
      details: error.message
    }, { status: 500 });
  }
}

// POST /api/stripe/prices - Create a new Stripe price
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
      product,
      unit_amount,
      currency = 'usd',
      recurring,
      metadata = {},
      nickname,
      tax_behavior = 'unspecified',
      tiers,
      tiers_mode,
      billing_scheme = 'per_unit',
      lookup_key,
      transfer_lookup_key = false,
      transform_quantity,
      active = true
    } = body;

    // Validate required fields
    if (!product) {
      return NextResponse.json({
        success: false,
        error: 'Product ID is required'
      }, { status: 400 });
    }

    if (!unit_amount && !tiers) {
      return NextResponse.json({
        success: false,
        error: 'Unit amount or tiers is required'
      }, { status: 400 });
    }

    // Build price data
    const priceData = {
      product,
      currency,
      metadata,
      nickname,
      tax_behavior,
      billing_scheme,
      lookup_key,
      transfer_lookup_key,
      active
    };

    if (unit_amount) {
      priceData.unit_amount = unit_amount;
    }

    if (tiers) {
      priceData.tiers = tiers;
    }

    if (tiers_mode) {
      priceData.tiers_mode = tiers_mode;
    }

    if (recurring) {
      priceData.recurring = recurring;
    }

    if (transform_quantity) {
      priceData.transform_quantity = transform_quantity;
    }

    // Create price in Stripe
    const price = await stripe.prices.create(priceData);

    return NextResponse.json({
      success: true,
      price: {
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
      },
      message: 'Price created successfully'
    });

  } catch (error) {
    console.error('Error creating Stripe price:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to create Stripe price',
      details: error.message
    }, { status: 500 });
  }
}
