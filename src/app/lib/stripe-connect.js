import { getStripe, isStripeConfigured } from '../../lib/stripe';

/**
 * Create a Stripe Connect Express account for an organization
 * @param {Object} organization - Organization details
 * @param {number} organization.id - Organization ID
 * @param {string} organization.name - Organization name
 * @param {string} organization.email - Organization email
 * @param {string} organization.country - Organization country (2-letter code, e.g., 'US', 'GB')
 * @param {string} organization.businessType - Business type: 'nonprofit', 'company', or 'individual'
 * @param {string} organization.taxId - Tax ID or EIN (optional)
 * @returns {Promise<Object>} Stripe account object
 */
export async function createStripeConnectAccount(organization) {
  try {
    if (!isStripeConfigured()) {
      throw new Error('Stripe is not configured');
    }

    const stripe = await getStripe();

    // Map business type to Stripe's business_type
    const businessTypeMap = {
      'nonprofit': 'nonprofit',
      'company': 'company',
      'individual': 'individual',
    };
    const stripeBusinessType = businessTypeMap[organization.businessType] || 'nonprofit';

    // Build account data
    const accountData = {
      type: 'express',
      country: organization.country || 'US',
      email: organization.email,
      capabilities: {
        card_payments:                { requested: true },
        transfers:                    { requested: true },
        us_bank_account_ach_payments: { requested: true },
      },
      business_type: stripeBusinessType,
      metadata: {
        organization_id: organization.id.toString(),
        organization_name: organization.name,
        created_by: 'organization_signup',
      },
      // Optional: Set business profile
      business_profile: {
        name: organization.name,
        url: organization.website || undefined,
        support_email: organization.email,
        support_phone: organization.phone || undefined,
        mcc: '8398', // Charitable and Social Service Organizations MCC code
      },
    };

    // Add tax ID if provided
    if (organization.taxId) {
      accountData.company = {
        tax_id: organization.taxId,
      };
    }

    // Create a Stripe Connect Express account
    // Express accounts are the simplest type and are best for most use cases
    const account = await stripe.accounts.create(accountData);

    console.log(`✅ Created Stripe Connect Account: ${account.id} for organization ${organization.id}`);

    // Create an account link for onboarding (optional - can be done later)
    // This allows the organization to complete their Stripe onboarding
    let accountLink = null;
    try {
      accountLink = await stripe.accountLinks.create({
        account: account.id,
        refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/organization/dashboard/stripe-products?refresh=true`,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/organization/dashboard/stripe-products?success=true`,
        type: 'account_onboarding',
      });

      console.log(`✅ Created Account Link for onboarding: ${accountLink.url}`);
    } catch (linkError) {
      console.warn('⚠️ Could not create account link (non-critical):', linkError.message);
      // Account link creation is optional, so we continue
    }

    return {
      account,
      accountLink,
    };
  } catch (error) {
    console.error('❌ Error creating Stripe Connect account:', error);
    throw new Error(`Failed to create Stripe Connect account: ${error.message}`);
  }
}

/**
 * Get the Stripe Connect account onboarding link
 * @param {string} accountId - Stripe account ID
 * @returns {Promise<string>} Account onboarding URL
 */
export async function getStripeAccountOnboardingLink(accountId) {
  try {
    if (!isStripeConfigured()) {
      throw new Error('Stripe is not configured');
    }

    const stripe = await getStripe();

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/organization/dashboard/stripe-products?refresh=true`,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/organization/dashboard/stripe-products?success=true`,
      type: 'account_onboarding',
    });

    return accountLink.url;
  } catch (error) {
    console.error('❌ Error creating account link:', error);
    throw new Error(`Failed to create account link: ${error.message}`);
  }
}

/**
 * Get Stripe Connect account details
 * @param {string} accountId - Stripe account ID
 * @returns {Promise<Object>} Stripe account object
 */
export async function getStripeConnectAccount(accountId) {
  try {
    if (!isStripeConfigured()) {
      throw new Error('Stripe is not configured');
    }

    const stripe = await getStripe();
    const account = await stripe.accounts.retrieve(accountId);

    return account;
  } catch (error) {
    console.error('❌ Error retrieving Stripe Connect account:', error);
    throw new Error(`Failed to retrieve Stripe Connect account: ${error.message}`);
  }
}

