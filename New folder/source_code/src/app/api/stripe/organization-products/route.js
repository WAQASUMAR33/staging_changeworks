import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const organizationId = searchParams.get('organization_id');
        const queryStripeAccountId = searchParams.get('stripe_account_id');

        if (!organizationId && !queryStripeAccountId) {
            return NextResponse.json({
                success: false,
                error: "Organization ID or Stripe Account ID is required"
            }, { status: 400 });
        }

        let organization = null;
        if (organizationId) {
            organization = await prisma.organization.findUnique({
                where: { id: parseInt(organizationId) },
                select: {
                    id: true,
                    name: true,
                    stripeAccountId: true,
                    stripeProductId1: true,
                    stripeProductId2: true,
                    stripeProductId3: true
                }
            });
        }

        const stripeAccountId = queryStripeAccountId || organization?.stripeAccountId;

        if (!stripeAccountId) {
            return NextResponse.json({
                success: false,
                error: "Stripe account ID not found"
            }, { status: 404 });
        }

        console.log(`🏢 Stripe Account: ${stripeAccountId}`);

        let productIds = [];
        if (organization) {
            productIds = [
                organization.stripeProductId1,
                organization.stripeProductId2,
                organization.stripeProductId3
            ].filter(Boolean);
        }

        let productsToFetch = [];

        if (productIds.length > 0) {
            console.log('🔍 Fetching specific products from DB:', productIds);
            productsToFetch = productIds;
        } else {
            console.log('🔍 No specific products in DB, fetching all active products from Stripe');
            const stripeProducts = await stripe.products.list({
                active: true,
                limit: 10
            }, {
                stripeAccount: stripeAccountId
            });
            productsToFetch = stripeProducts.data.map(p => p.id);
        }

        if (productsToFetch.length === 0) {
            return NextResponse.json({
                success: false,
                error: "No products found for this account"
            }, { status: 404 });
        }

        // Fetch products and their prices from the connected account
        const productsWithPrices = await Promise.all(
            productsToFetch.map(async (productId) => {
                try {
                    console.log(`📦 Retrieving Stripe Product: ${productId} from Account: ${stripeAccountId}`);
                    const product = await stripe.products.retrieve(productId, {
                        stripeAccount: stripeAccountId
                    });

                    console.log(`💰 Listing prices for Product: ${productId}`);
                    const prices = await stripe.prices.list({
                        product: productId,
                        active: true,
                        limit: 10
                    }, {
                        stripeAccount: stripeAccountId
                    });

                    console.log(`📄 Found ${prices.data.length} prices for Product: ${productId}`);

                    // Find the first active RECURRING price
                    const recurringPrice = prices.data.find(p => (p.type === 'recurring' || p.recurring) && p.active);
                    // Find any active price as fallback
                    const anyPrice = prices.data.find(p => p.active);

                    if (!recurringPrice) {
                        console.warn(`⚠️ Product ${productId} has no recurring price.`);
                        return {
                            id: product.id,
                            name: product.name,
                            error: "No recurring price found",
                            hasOneTimePrice: !!anyPrice,
                            priceCount: prices.data.length
                        };
                    }

                    console.log(`✅ Valid recurring price found for ${productId}: ${recurringPrice.id}`);
                    return {
                        id: product.id,
                        name: product.name,
                        description: product.description,
                        images: product.images,
                        price: {
                            id: recurringPrice.id,
                            unit_amount: recurringPrice.unit_amount,
                            currency: recurringPrice.currency,
                            recurring: recurringPrice.recurring
                        }
                    };
                } catch (err) {
                    console.error(`❌ Error fetching product ${productId}:`, err.message);
                    return {
                        id: productId,
                        error: "Stripe retrieval failed",
                        message: err.message
                    };
                }
            })
        );

        const filteredProducts = productsWithPrices.filter(p => p && p.price);
        const productsWithErrors = productsWithPrices.filter(p => p && !p.price);

        return NextResponse.json({
            success: true,
            products: filteredProducts,
            nonRecurringProducts: productsWithErrors,
            debug: {
                organizationId: organizationId,
                stripeAccountId: stripeAccountId,
                checkedProductCount: productsToFetch.length,
                filteredCount: filteredProducts.length
            }
        });

    } catch (error) {
        console.error('Error in organization-products API:', error);
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            details: error.message
        }, { status: 500 });
    }
}
