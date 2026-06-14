import { NextResponse } from 'next/server';
import { prisma } from '../../../lib/prisma.jsx';
import emailService from '../../../lib/email-service';
import { corsHeaders } from '@/app/lib/cors';

// Helper: is today the last day of the current month?
function isLastDayOfMonth() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  return tomorrow.getMonth() !== now.getMonth();
}

/**
 * GET /api/cron/monthly-donation-summary
 *
 * Called by a cron scheduler on the last day of every month (or daily —
 * the handler itself checks whether today really is the last day).
 *
 * Secure with CRON_SECRET env var. Pass it as the `Authorization` header:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 *   ?force=true   — skip the "last day of month" guard (useful for testing)
 */
export async function GET(request) {
  try {
    // --- Auth check ---
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // --- Last-day guard ---
    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';
    if (!force && !isLastDayOfMonth()) {
      return NextResponse.json({
        success: true,
        skipped: true,
        message: 'Not the last day of the month — skipping.',
      });
    }

    // --- Determine the current month window ---
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const monthEnd   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const monthLabel = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });

    const appBase = (() => {
      let base = process.env.NEXT_PUBLIC_APP_URL || 'https://app.changeworksfund.org';
      if (!/^https?:\/\//i.test(base)) base = `https://${base}`;
      return base.replace(/\/$/, '');
    })();
    const dashboardLink = `${appBase}/donor/login`;

    // --- Fetch all transactions in the month window ---
    const transactions = await prisma.donorTransaction.findMany({
      where: {
        created_at: { gte: monthStart, lte: monthEnd },
        status: { in: ['succeeded', 'paid', 'completed', 'success'] },
      },
      include: {
        donor: {
          select: { id: true, name: true, email: true },
        },
        organization: {
          select: { id: true, name: true, email: true, imageUrl: true },
        },
      },
      orderBy: { created_at: 'asc' },
    });

    if (transactions.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No transactions found for this month.',
        month: monthLabel,
        emailsSent: 0,
      });
    }

    // --- Group by donor + org ---
    const groups = {};
    for (const tx of transactions) {
      const key = `${tx.donor_id}::${tx.organization_id}`;
      if (!groups[key]) {
        groups[key] = {
          donor: tx.donor,
          organization: tx.organization,
          donations: [],
          total: 0,
        };
      }
      groups[key].donations.push({
        date: tx.created_at,
        type: tx.transaction_type,
        description: tx.payment_method || tx.transaction_type,
        amount: tx.amount,
        transactionId: tx.trnx_id,
      });
      groups[key].total += tx.amount;
    }

    // --- Send an email for each donor+org combo ---
    const results = [];
    for (const group of Object.values(groups)) {
      const { donor, organization, donations, total } = group;

      try {
        const result = await emailService.sendMonthlyDonationSummaryEmail({
          donor,
          organization,
          month: monthLabel,
          totalAmount: total,
          donations,
          dashboardLink,
        });

        results.push({
          donorId: donor.id,
          donorEmail: donor.email,
          orgId: organization.id,
          orgName: organization.name,
          totalAmount: total,
          donationCount: donations.length,
          success: result.success,
          error: result.error || null,
        });

        console.log(
          `✅ Monthly summary sent → ${donor.email} (${organization.name}) — $${total.toFixed(2)}, ${donations.length} donation(s)`
        );
      } catch (err) {
        console.error(`❌ Failed to send summary to ${donor.email} (${organization.name}):`, err.message);
        results.push({
          donorId: donor.id,
          donorEmail: donor.email,
          orgId: organization.id,
          orgName: organization.name,
          success: false,
          error: err.message,
        });
      }
    }

    const sent  = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return NextResponse.json({
      success: true,
      message: `Monthly donation summary emails processed.`,
      month: monthLabel,
      emailsSent: sent,
      emailsFailed: failed,
      results,
    });
  } catch (error) {
    console.error('❌ Monthly donation summary cron error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
