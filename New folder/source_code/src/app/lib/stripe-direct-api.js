/**
 * Stripe Direct API Helper Functions
 * These functions make direct HTTP calls to Stripe API using Basic Auth
 * instead of using the Stripe SDK
 */

/**
 * Create a Stripe Express account using direct API call
 * @param {string} country - Country code (2-letter, e.g., 'US', 'GB')
 * @returns {Promise<Object>} Stripe account object with id
 */
export async function createStripeAccountDirect(country) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('type', 'express');
    formData.append('capabilities[card_payments][requested]', 'true');
    formData.append('capabilities[transfers][requested]', 'true');
    formData.append('country', country || 'US');

    // Make API call with Basic Auth
    const response = await fetch('https://api.stripe.com/v1/accounts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${stripeSecretKey}:`).toString('base64')}`
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || `Stripe API error: ${response.status}`;
      console.error('❌ Stripe API error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        details: data.error || data
      };
    }

    console.log(`✅ Created Stripe Connect Account via Direct API: ${data.id}`);

    return {
      success: true,
      account: {
        id: data.id,
        type: data.type,
        country: data.country,
        charges_enabled: data.charges_enabled,
        payouts_enabled: data.payouts_enabled,
        details_submitted: data.details_submitted
      }
    };
  } catch (error) {
    console.error('❌ Error creating Stripe account via Direct API:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Stripe account',
      details: error
    };
  }
}

/**
 * Create a Stripe account onboarding link using direct API call
 * @param {string} accountId - Stripe account ID
 * @param {string} refreshUrl - URL to redirect to if user refreshes during onboarding
 * @param {string} returnUrl - URL to redirect to after successful onboarding
 * @returns {Promise<Object>} Account link object with url
 */
export async function createStripeAccountLinkDirect(accountId, refreshUrl, returnUrl) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    if (!accountId) {
      throw new Error('Account ID is required');
    }

    // Prepare form data
    const formData = new URLSearchParams();
    formData.append('account', accountId);
    formData.append('refresh_url', refreshUrl);
    formData.append('return_url', returnUrl);
    formData.append('type', 'account_onboarding');

    // Make API call with Basic Auth
    const response = await fetch('https://api.stripe.com/v1/account_links', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${stripeSecretKey}:`).toString('base64')}`
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || `Stripe API error: ${response.status}`;
      console.error('❌ Stripe API error:', errorMessage);
      return {
        success: false,
        error: errorMessage,
        details: data.error || data
      };
    }

    console.log(`✅ Created Stripe Account Link via Direct API: ${data.url}`);

    return {
      success: true,
      accountLink: {
        url: data.url,
        expires_at: data.expires_at,
        created: data.created
      }
    };
  } catch (error) {
    console.error('❌ Error creating Stripe account link via Direct API:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Stripe account link',
      details: error
    };
  }
}

/**
 * Create a Stripe product using direct API call on behalf of a connected account
 * @param {string} stripeAccountId - Connected account ID
 * @param {string} name - Product name
 * @param {string} description - Product description
 * @returns {Promise<Object>} Result object with product data
 */
export async function createStripeProductDirect(stripeAccountId, name, description) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    if (!stripeAccountId) {
      throw new Error('Stripe Account ID is required');
    }

    const formData = new URLSearchParams();
    formData.append('name', name);
    formData.append('description', description || name);
    formData.append('active', 'true');

    const response = await fetch('https://api.stripe.com/v1/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${stripeSecretKey}:`).toString('base64')}`,
        'Stripe-Account': stripeAccountId
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || `Stripe API error: ${response.status}`,
        details: data.error || data
      };
    }

    return {
      success: true,
      product: data
    };
  } catch (error) {
    console.error('❌ Error creating Stripe product via Direct API:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Stripe product'
    };
  }
}

/**
 * Create a Stripe price for a product on behalf of a connected account
 * @param {string} stripeAccountId - Connected account ID
 * @param {string} productId - Stripe product ID
 * @param {number} amount - Amount in cents
 * @param {string} currency - Currency code (default: 'usd')
 * @param {string} interval - Recurring interval ('month', 'year', etc.)
 * @returns {Promise<Object>} Result object with price data
 */
export async function createStripePriceDirect(stripeAccountId, productId, amount, currency = 'usd', interval = null) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }

    if (!stripeAccountId) {
      throw new Error('Stripe Account ID is required');
    }

    const formData = new URLSearchParams();
    formData.append('product', productId);
    formData.append('unit_amount', Math.round(amount).toString());
    formData.append('currency', currency || 'usd');

    if (interval) {
      formData.append('recurring[interval]', interval);
    }

    const response = await fetch('https://api.stripe.com/v1/prices', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${stripeSecretKey}:`).toString('base64')}`,
        'Stripe-Account': stripeAccountId
      },
      body: formData.toString()
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.error?.message || `Stripe API error: ${response.status}`,
        details: data.error || data
      };
    }

    return {
      success: true,
      price: data
    };
  } catch (error) {
    console.error('❌ Error creating Stripe price via Direct API:', error);
    return {
      success: false,
      error: error.message || 'Failed to create Stripe price'
    };
  }
}
