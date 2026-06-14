import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { getStripeConnectAccount } from "../../../lib/stripe-connect";
import { getStripe } from "../../../../lib/stripe";
import { getStripeAccount } from "../../../lib/payment-provider/tokenStore";
import { corsHeaders } from '@/app/lib/cors';

export async function GET(request) {
  try {
    // Get organization ID from query params or headers
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({
        success: false,
        error: 'Organization ID is required'
      }, { status: 400 });
    }

    const orgId = parseInt(organizationId);

    // Get current date for filtering
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);

    // Get organization data
    let organization = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        imageUrl: true,
        ghlId: true,
        stripeAccountId: true,
        stripeProductId1: true,
        stripeProductId2: true,
        stripeProductId3: true
      }
    });

    if (!organization) {
      return NextResponse.json({
        success: false,
        error: 'Organization not found'
      }, { status: 404 });
    }

    // Resolve Stripe account ID — prefer org.stripeAccountId, fall back to ghlStripeConnection.
    let resolvedStripeAccountId = organization.stripeAccountId || null;
    if (!resolvedStripeAccountId) {
      try {
        // Look up the GHL location for this org and check ghlStripeConnection.
        const ghlLocation = await prisma.gHLAccount.findFirst({
          where: { organization_id: orgId, status: 'active' },
          select: { ghl_location_id: true },
          orderBy: { created_at: 'desc' },
        });
        const locationId = ghlLocation?.ghl_location_id || organization.ghlId || null;
        if (locationId) {
          const conn = await getStripeAccount(locationId);
          if (conn?.stripeAccountId) {
            resolvedStripeAccountId = conn.stripeAccountId;
            // Back-fill the missing stripeAccountId on the org so future loads are fast.
            await prisma.organization.update({
              where: { id: orgId },
              data:  { stripeAccountId: resolvedStripeAccountId },
            });
            console.log(`[dashboard-stats] Back-filled stripeAccountId ${resolvedStripeAccountId} → org ${orgId}`);
          }
        }
      } catch (e) {
        console.error('[dashboard-stats] ghlStripeConnection fallback failed:', e.message);
      }
    }

    // Check Stripe Status
    let stripeStatus = {
        details_submitted: false,
        charges_enabled: false,
        api_error: false,   // true when Stripe responded but with an error (key mismatch etc.)
    };

    if (resolvedStripeAccountId) {
        try {
            const account = await getStripeConnectAccount(resolvedStripeAccountId);
            stripeStatus.details_submitted = account.details_submitted;
            stripeStatus.charges_enabled = account.charges_enabled;
        } catch (e) {
            console.error('Failed to fetch stripe account status', e);
            // Mark as api_error so the UI doesn't incorrectly show "Complete Setup Required"
            // when the account IS set up but the API call failed (e.g. wrong key mode).
            stripeStatus.api_error = true;
            stripeStatus.details_submitted = true;   // assume complete — don't block the user
            stripeStatus.charges_enabled = true;
        }
    }

    // Expose the resolved ID (may differ from organization.stripeAccountId if back-filled above)
    organization = { ...organization, stripeAccountId: resolvedStripeAccountId ?? organization.stripeAccountId };

    // Fetch live totals from Stripe if connected
    let totalDonationsAmount = 0;
    let thisMonthAmount = 0;
    let lastMonthAmount = 0;

    if (resolvedStripeAccountId) {
      try {
        const stripe = await getStripe();
        const paymentIntents = await stripe.paymentIntents.list(
          { limit: 100, expand: ['data.latest_charge'] },
          { stripeAccount: resolvedStripeAccountId }
        );

        for (const pi of paymentIntents.data) {
          if (pi.status !== 'succeeded') continue;
          const amount = pi.amount / 100;
          const created = new Date(pi.created * 1000);
          totalDonationsAmount += amount;
          if (created >= startOfMonth) thisMonthAmount += amount;
          if (created >= startOfLastMonth && created < endOfLastMonth) lastMonthAmount += amount;
        }
      } catch (e) {
        console.error('[dashboard-stats] Stripe fetch failed:', e.message);
      }
    }

    const stats = {
      totalDonations: {
        value: `$${totalDonationsAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        change: '0%',
        changeType: 'increase'
      },
      thisMonth: {
        value: `$${thisMonthAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        change: '0%',
        changeType: 'increase'
      }
    };

    // Get recent activity for this organization
    const recentActivity = await prisma.saveTrRecord.findMany({
      where: {
        trx_organization_id: orgId
      },
      take: 5,
      orderBy: { created_at: 'desc' },
      include: {
        donor: {
          select: { name: true, email: true }
        }
      }
    });

    const formattedActivity = recentActivity.map(activity => ({
      id: activity.id,
      type: 'donation',
      title: 'New donation received',
      description: `${activity.donor.name} donated $${activity.trx_amount} to your cause`,
      time: formatTimeAgo(activity.created_at),
      color: 'green'
    }));

    // Add GHL account creation activity if available
    const recentGhlAccounts = await prisma.gHLAccount.findMany({
      where: {
        organization_id: orgId
      },
      take: 2,
      orderBy: { created_at: 'desc' }
    });

    recentGhlAccounts.forEach(account => {
      formattedActivity.push({
        id: `ghl-${account.id}`,
        type: 'ghl',
        title: 'GHL account created',
        description: `New GoHighLevel sub-account "${account.business_name}" created`,
        time: formatTimeAgo(account.created_at),
        color: 'blue'
      });
    });

    // Sort by most recent
    formattedActivity.sort((a, b) => new Date(b.time) - new Date(a.time));

    return NextResponse.json({
      success: true,
      organization: {
        ...organization,
        stripeStatus
      },
      stats,
      recentActivity: formattedActivity.slice(0, 3)
    });

  } catch (error) {
    console.error('Error fetching organization dashboard stats:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch dashboard statistics'
    }, { status: 500 });
  }
}

function formatTimeAgo(date) {
  const now = new Date();
  const diff = now - new Date(date);

  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (minutes < 60) {
    return `${minutes} min ago`;
  } else if (hours < 24) {
    return `${hours} hour${hours > 1 ? 's' : ''} ago`;
  } else {
    return `${days} day${days > 1 ? 's' : ''} ago`;
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
