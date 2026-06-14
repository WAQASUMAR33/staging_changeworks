import { NextResponse } from 'next/server';
import { createStripeClient } from '@/app/lib/payment-mode';
import { prisma } from '../../../lib/prisma';
import jwt from 'jsonwebtoken';
import { corsHeaders } from '@/app/lib/cors';


export async function GET(req) {
  try {
    const stripe = await createStripeClient();
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'No token provided' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (error) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const organization = await prisma.organization.findUnique({
      where: { id: decoded.id },
      select: { stripeAccountId: true }
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    if (!organization.stripeAccountId) {
      return NextResponse.json({ 
        subscriptions: [], 
        message: 'No Stripe Connect account found' 
      });
    }

    // Fetch subscriptions from the connected account
    const subscriptions = await stripe.subscriptions.list({
      limit: 100,
      status: 'all',
      expand: ['data.customer', 'data.plan.product']
    }, {
      stripeAccount: organization.stripeAccountId,
    });

    return NextResponse.json({ subscriptions: subscriptions.data });

  } catch (error) {
    console.error('Error fetching subscriptions:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
