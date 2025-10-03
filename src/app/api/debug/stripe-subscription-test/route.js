import { NextResponse } from "next/server";
import Stripe from "stripe";

export async function GET(request) {
  try {
    console.log('=== Stripe Subscription API Debug ===');
    
    // Check environment variables
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY;
    const nextPublicStripeKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
    
    console.log('Environment Variables:');
    console.log('- STRIPE_SECRET_KEY:', stripeSecretKey ? 'Set (length: ' + stripeSecretKey.length + ')' : 'NOT SET');
    console.log('- STRIPE_PUBLISHABLE_KEY:', stripePublishableKey ? 'Set (length: ' + stripePublishableKey.length + ')' : 'NOT SET');
    console.log('- NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:', nextPublicStripeKey ? 'Set (length: ' + nextPublicStripeKey.length + ')' : 'NOT SET');
    
    if (!stripeSecretKey) {
      return NextResponse.json({
        success: false,
        error: 'STRIPE_SECRET_KEY not found in environment variables',
        debug: {
          stripeSecretKey: !!stripeSecretKey,
          stripePublishableKey: !!stripePublishableKey,
          nextPublicStripeKey: !!nextPublicStripeKey
        }
      }, { status: 500 });
    }
    
    // Initialize Stripe
    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16',
    });
    
    console.log('Stripe initialized successfully');
    
    // Test 1: List products
    console.log('Testing: List products...');
    const products = await stripe.products.list({
      active: true,
      limit: 5
    });
    
    console.log('Products found:', products.data.length);
    
    // Test 2: List prices
    console.log('Testing: List prices...');
    const prices = await stripe.prices.list({
      active: true,
      limit: 5
    });
    
    console.log('Prices found:', prices.data.length);
    
    // Test 3: Check if we have subscription products
    const subscriptionProducts = products.data.filter(product => 
      product.type === 'service' || product.metadata?.type === 'subscription'
    );
    
    console.log('Subscription products:', subscriptionProducts.length);
    
    return NextResponse.json({
      success: true,
      message: 'Stripe API is working',
      debug: {
        environment: {
          stripeSecretKey: !!stripeSecretKey,
          stripePublishableKey: !!stripePublishableKey,
          nextPublicStripeKey: !!nextPublicStripeKey
        },
        stripe: {
          productsCount: products.data.length,
          pricesCount: prices.data.length,
          subscriptionProductsCount: subscriptionProducts.length
        },
        products: products.data.map(p => ({
          id: p.id,
          name: p.name,
          active: p.active,
          type: p.type,
          metadata: p.metadata
        })),
        prices: prices.data.map(p => ({
          id: p.id,
          product: p.product,
          active: p.active,
          unit_amount: p.unit_amount,
          currency: p.currency,
          recurring: p.recurring
        }))
      }
    });
    
  } catch (error) {
    console.error('Stripe API Test Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Stripe API test failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
