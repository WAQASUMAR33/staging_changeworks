import { NextResponse } from 'next/server';
import { createStripeClient } from '@/app/lib/payment-mode';
import { prisma } from '../../../../lib/prisma';
import jwt from 'jsonwebtoken';

export async function POST(req) {
  try {
    const stripe = await createStripeClient();
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: decoded.id },
      select: { stripeAccountId: true },
    });

    if (!organization?.stripeAccountId) {
      return NextResponse.json({ error: 'No Stripe account found' }, { status: 404 });
    }

    const { stripe_subscription_id, cancel_immediately = false } = await req.json();
    if (!stripe_subscription_id) {
      return NextResponse.json({ error: 'stripe_subscription_id is required' }, { status: 400 });
    }

    const stripeOptions = { stripeAccount: organization.stripeAccountId };

    if (cancel_immediately) {
      await stripe.subscriptions.cancel(stripe_subscription_id, stripeOptions);
    } else {
      await stripe.subscriptions.update(stripe_subscription_id, { cancel_at_period_end: true }, stripeOptions);
    }

    // Best-effort local DB update
    try {
      const newStatus = cancel_immediately ? 'CANCELED' : 'CANCELED_AT_PERIOD_END';
      const cancelAtPeriodEnd = cancel_immediately ? 0 : 1;
      await prisma.$executeRaw`
        UPDATE subscriptions
        SET status = ${newStatus}, cancel_at_period_end = ${cancelAtPeriodEnd}, updated_at = NOW()
        WHERE stripe_subscription_id = ${stripe_subscription_id}
      `;
    } catch (dbErr) {
      console.warn('Could not update local subscription record:', dbErr.message);
    }

    return NextResponse.json({
      success: true,
      message: cancel_immediately
        ? 'Subscription canceled immediately'
        : 'Subscription scheduled for cancellation at period end',
    });
  } catch (error) {
    console.error('Error canceling subscription:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to cancel subscription' },
      { status: 500 }
    );
  }
}
