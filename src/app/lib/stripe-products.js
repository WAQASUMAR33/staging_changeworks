import { getStripe } from '../../lib/stripe';

/**
 * Create 3 custom Stripe products for an organization
 * @param {Object} organization - Organization details
 * @param {string} organization.id - Organization ID
 * @param {string} organization.name - Organization name
 * @param {string} organization.email - Organization email
 * @returns {Promise<{product1: Object, product2: Object, product3: Object}>}
 */
export async function createOrganizationStripeProducts(organization) {
  try {
    const stripe = await getStripe();

    // Product 1: Package 1
    const product1 = await stripe.products.create({
      name: `${organization.name} - Donation Option 1`,
      description: `Donation Option 1 for ${organization.name}`,
      active: true,
      type: 'service',
      metadata: {
        organization_id: organization.id.toString(),
        organization_name: organization.name,
        product_type: 'one_time_donation',
        created_by: 'organization_signup'
      },
    });

    console.log(`Created Donation Option 1 (Option 1): ${product1.id}`);

    // Product 2: Package 2
    const product2 = await stripe.products.create({
      name: `${organization.name} - Donation Option 2`,
      description: `Donation Option 2 for ${organization.name}`,
      active: true,
      type: 'service',
      metadata: {
        organization_id: organization.id.toString(),
        organization_name: organization.name,
        product_type: 'monthly_recurring',
        created_by: 'organization_signup'
      },
    });

     console.log(`Created Donation Option 2 (Option 2): ${product2.id}`);

    // Product 3: Package 3
    const product3 = await stripe.products.create({
      name: `${organization.name} - Donation Option 3`,
      description: `Donation Option 3 for ${organization.name}`,
      active: true,
      type: 'service',
      metadata: {
        organization_id: organization.id.toString(),
        organization_name: organization.name,
        product_type: 'round_up',
        created_by: 'organization_signup'
      },
    });

 console.log(`Created Donation Option 3 (Option 3): ${product3.id}`);

    return {
      product1,
      product2,
      product3,
    };
  } catch (error) {
    console.error('❌ Error creating Donation Options:', error);
    throw new Error(`Failed to create Stripe Donation Options: ${error.message}`);
  }
}

/**
 * Create default prices for organization products
 * @param {Object} products - The 3 products created
 * @param {Object} organization - Organization details
 * @param {Object} customPrices - Optional custom prices in cents {product1Price, product2Price, product3Price}
 * @returns {Promise<{price1: Object, price2: Object, price3: Object}>}
 */
export async function createDefaultPricesForProducts(products, organization, customPrices = null) {
  try {
    const stripe = await getStripe();

    // Use custom prices if provided, otherwise use defaults
    const product1PriceCents = customPrices?.product1Price || 1000; // Default $10.00
    const product2PriceCents = customPrices?.product2Price || 2500; // Default $25.00
    const product3PriceCents = customPrices?.product3Price || 100; // Default $1.00

    // Price 1: One-Time Donation
    const price1 = await stripe.prices.create({
      product: products.product1.id,
      currency: 'usd',
      unit_amount: product1PriceCents,
      metadata: {
        organization_id: organization.id.toString(),
        price_type: 'one_time_donation',
        is_default: 'true',
        custom_price: customPrices ? 'true' : 'false'
      },
    });

    console.log(`✅ Created Price for Donation Option 1: ${price1.id} ($${(product1PriceCents / 100).toFixed(2)})`);

    // Price 2: Monthly Recurring
    const price2 = await stripe.prices.create({
      product: products.product2.id,
      currency: 'usd',
      unit_amount: product2PriceCents,
      recurring: {
        interval: 'month',
      },
      metadata: {
        organization_id: organization.id.toString(),
        price_type: 'monthly_recurring',
        is_default: 'true',
        custom_price: customPrices ? 'true' : 'false'
      },
    });

    console.log(`✅ Created Price for Donation Option 2: ${price2.id} ($${(product2PriceCents / 100).toFixed(2)}/month)`);

    // Price 3: Round Up (represented as a small base amount, actual round up logic handled elsewhere)
    const price3 = await stripe.prices.create({
      product: products.product3.id,
      currency: 'usd',
      unit_amount: product3PriceCents,
      metadata: {
        organization_id: organization.id.toString(),
        price_type: 'round_up',
        is_default: 'true',
        custom_price: customPrices ? 'true' : 'false'
      },
    });

    console.log(`✅ Created Price for Donation Option 3: ${price3.id} ($${(product3PriceCents / 100).toFixed(2)})`);

    return {
      price1,
      price2,
      price3,
    };
  } catch (error) {
    console.error('âŒ Error creating default prices:', error);
    throw new Error(`Failed to create default prices: ${error.message}`);
  }
}



