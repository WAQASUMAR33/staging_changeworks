import axios from 'axios';
import { prisma } from '../../../../lib/prisma';
import { corsHeaders } from '@/app/lib/cors';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
const GHL_API  = 'https://services.leadconnectorhq.com';

/**
 * GHL Marketplace App - Install / OAuth Authorization
 *
 * GHL redirects here after the user clicks "Install" in the marketplace.
 * Query params: ?code=&companyId=&userId=&ghl_id=&amount=&product_id=&type=
 *
 * Full flow:
 *  1. Exchange code → access_token + refresh_token
 *  2. Fetch location details from GHL API
 *  3. Save installation to ghl_app_installations table
 *  4. Register as Custom Payment Provider with GHL
 *  5. Redirect back to GHL dashboard
 */
export async function GET(req) {
  const { searchParams } = new URL(req.url);

  const code      = searchParams.get('code');
  const companyId = searchParams.get('companyId');
  const userId    = searchParams.get('userId');
  const ghlId     = searchParams.get('ghl_id');
  const amount    = searchParams.get('amount');
  const productId = searchParams.get('product_id');
  const type      = searchParams.get('type');

  if (!code) {
    return Response.json({ success: false, message: 'Missing authorization code' }, { status: 400 });
  }

  try {
    // ── Step 1: Exchange code for OAuth tokens ────────────────────────────────
    const tokenResponse = await axios.post(
      `${GHL_API}/oauth/token`,
      new URLSearchParams({
        client_id:     process.env.GHL_APP_CLIENT_ID,
        client_secret: process.env.GHL_APP_CLIENT_SECRET,
        grant_type:    'authorization_code',
        code,
        redirect_uri:  process.env.GHL_APP_REDIRECT_URI,
      }),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    const {
      access_token,
      refresh_token,
      expires_in,
      locationId,
      scope,
    } = tokenResponse.data;

    console.log('GHL OAuth token exchange success', {
      locationId,
      companyId,
      scope,
      expires_in,
    });

    // ── Step 2: Fetch location details from GHL ───────────────────────────────
    let locationData = null;
    try {
      const locationRes = await axios.get(`${GHL_API}/locations/${locationId}`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
          Version: '2021-07-28',
        },
      });
      locationData = locationRes.data?.location || locationRes.data;
      console.log('GHL location fetched:', locationData?.name);
    } catch (locErr) {
      console.warn('Could not fetch location details (non-critical):', locErr.message);
    }

    // ── Step 3: Save installation to DB ──────────────────────────────────────
    await prisma.gHLAppInstallation.upsert({
      where:  { location_id: locationId },
      update: {
        access_token,
        refresh_token,
        expires_in,
        scope,
        company_id: companyId,
        user_id:    userId,
        ghl_id:     ghlId,
        amount,
        product_id: productId,
        type,
        status:     'active',
        updated_at: new Date(),
      },
      create: {
        location_id:   locationId,
        company_id:    companyId,
        user_id:       userId,
        access_token,
        refresh_token,
        expires_in,
        scope,
        ghl_id:        ghlId,
        amount,
        product_id:    productId,
        type,
        status:        'active',
      },
    });

    console.log('GHL installation saved to DB for location:', locationId);

    // ── Step 4: Register as Custom Payment Provider with GHL ─────────────────
    try {
      await axios.post(
        `${GHL_API}/payments/custom-provider/provider`,
        {
          name:        'Changeworks Payments',
          description: 'Stripe-powered payment collection via Changeworks',
          paymentsUrl: `${BASE_URL}/api/ghl_api/marketplace/payment-provider`,
          queryUrl:    `${BASE_URL}/api/ghl_api/marketplace/payment`,
          imageUrl:    `${BASE_URL}/logo.png`,
        },
        {
          headers: {
            Authorization: `Bearer ${access_token}`,
            'Content-Type': 'application/json',
            Version: '2021-07-28',
          },
        }
      );
      console.log('GHL custom payment provider registered for location:', locationId);
    } catch (providerErr) {
      // Non-fatal: provider may already be registered
      console.warn('Payment provider registration (non-critical):', providerErr.response?.data || providerErr.message);
    }

    // ── Step 5: Redirect to GHL dashboard ────────────────────────────────────
    const redirectUrl =
      process.env.GHL_POST_INSTALL_REDIRECT ||
      `https://app.gohighlevel.com/location/${locationId}/settings/integrations`;

    return Response.redirect(redirectUrl, 302);

  } catch (error) {
    console.error('GHL install error', {
      message: error.message,
      status:  error.response?.status,
      data:    error.response?.data,
    });

    return Response.json(
      {
        success: false,
        message: 'GHL app installation failed',
        error:   error.response?.data || error.message,
      },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
