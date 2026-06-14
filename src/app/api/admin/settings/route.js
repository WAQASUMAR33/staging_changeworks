import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma';
import { verifyAdminToken } from '../../../lib/admin-auth';
import { clearPaymentModeCache } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';

// Default settings seeded when not in DB yet
const DEFAULTS = {
  roundup_minimum_threshold: {
    value: '1.00',
    label: 'Round-Up Minimum Threshold ($)',
    description: 'Minimum accumulated round-up amount before charging donor via ACH. Stripe rejects charges below $1.00.',
  },
  payment_mode: {
    value: 'sandbox',
    label: 'Payment Mode',
    description: 'Switch between sandbox (test) and live payment processing for Stripe and Plaid.',
  },
};

function authGuard(request) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return verifyAdminToken(authHeader.substring(7));
}

// GET /api/admin/settings — return all settings (merged with defaults)
export async function GET(request) {
  const decoded = authGuard(request);
  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = await prisma.appSetting.findMany();
    const stored = Object.fromEntries(rows.map((r) => [r.key, r]));

    // Merge stored values with defaults so all keys are always present
    const settings = Object.entries(DEFAULTS).map(([key, def]) => ({
      key,
      value: stored[key]?.value ?? def.value,
      label: def.label,
      description: def.description,
      updated_at: stored[key]?.updated_at ?? null,
      updated_by: stored[key]?.updated_by ?? null,
    }));

    return NextResponse.json({ success: true, settings });
  } catch (error) {
    console.error('admin settings GET error:', error);
    return NextResponse.json({ success: false, error: 'Failed to load settings' }, { status: 500 });
  }
}

// PUT /api/admin/settings — upsert one setting
// Body: { key, value }
export async function PUT(request) {
  const decoded = authGuard(request);
  if (!decoded) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { role: true, email: true },
    });

    if (!user || !['ADMIN', 'SUPERADMIN'].includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    const { key, value } = await request.json();

    if (!key || value === undefined || value === null || value === '') {
      return NextResponse.json({ success: false, error: 'key and value are required' }, { status: 400 });
    }

    if (!(key in DEFAULTS)) {
      return NextResponse.json({ success: false, error: `Unknown setting key: ${key}` }, { status: 400 });
    }

    // Validate numeric settings
    if (key === 'roundup_minimum_threshold') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 1.00) {
        return NextResponse.json(
          { success: false, error: 'Minimum threshold must be $1.00 or higher (Stripe ACH minimum)' },
          { status: 400 }
        );
      }
    }

    // Validate payment_mode
    if (key === 'payment_mode' && !['sandbox', 'live'].includes(value)) {
      return NextResponse.json(
        { success: false, error: 'payment_mode must be "sandbox" or "live"' },
        { status: 400 }
      );
    }

    const setting = await prisma.appSetting.upsert({
      where:  { key },
      update: { value: String(value), updated_by: user.email },
      create: {
        key,
        value:       String(value),
        label:       DEFAULTS[key].label,
        description: DEFAULTS[key].description,
        updated_by:  user.email,
      },
    });

    // Clear in-memory mode cache so next request picks up the change immediately.
    // Also sync all ghlStripeConnection records so the publishableKey and livemode
    // stored in DB reflect the new mode — otherwise create-intent returns stale test keys.
    if (key === 'payment_mode') {
      clearPaymentModeCache();
      const isLive = value === 'live';
      const pubKey = isLive
        ? (process.env.STRIPE_PUBLISHABLE_KEY_LIVE  ?? '')
        : (process.env.STRIPE_PUBLISHABLE_KEY_SANDBOX ?? '');
      if (pubKey) {
        await prisma.ghlStripeConnection.updateMany({
          data: { livemode: isLive, publishableKey: pubKey },
        });
        console.log(`[settings] Synced ghlStripeConnection rows to ${value} mode (pubKey: ${pubKey.slice(0, 12)}...)`);
      }
    }

    return NextResponse.json({ success: true, setting });
  } catch (error) {
    console.error('admin settings PUT error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update setting' }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
