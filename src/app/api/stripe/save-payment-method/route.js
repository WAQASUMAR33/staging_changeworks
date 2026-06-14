import { NextResponse } from 'next/server';
import { createStripeClient } from '@/app/lib/payment-mode';
import { prisma } from '@/app/lib/prisma';
import jwt from 'jsonwebtoken';
import { corsHeaders } from '@/app/lib/cors';


export async function POST(request) {
  try {
    const stripe = await createStripeClient();
    // Verify JWT
    const token = request.headers.get('authorization')?.split(' ')[1];
    if (!token) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const donorId = decoded.id;

    const { token_id, organization_id } = await request.json();
    if (!token_id) {
      return NextResponse.json({ success: false, error: 'token_id is required' }, { status: 400 });
    }
    if (!organization_id) {
      return NextResponse.json({ success: false, error: 'organization_id is required' }, { status: 400 });
    }

    // Load donor and org's Stripe connected account
    const [donor, org] = await Promise.all([
      prisma.donor.findUnique({ where: { id: donorId } }),
      prisma.organization.findUnique({
        where: { id: organization_id },
        select: { stripeAccountId: true },
      }),
    ]);

    if (!donor) {
      return NextResponse.json({ success: false, error: 'Donor not found' }, { status: 404 });
    }
    if (!org?.stripeAccountId) {
      return NextResponse.json({ success: false, error: 'Organization has no Stripe account connected' }, { status: 400 });
    }

    const orgStripeAccountId = org.stripeAccountId.trim();

    // Check if this donor already has a customer on this org's connected account
    const existing = await prisma.$queryRaw`
      SELECT stripe_customer_id
      FROM donor_payment_methods
      WHERE donor_id      = ${donorId}
        AND organization_id = ${organization_id}
        AND status        = 'active'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    let stripeCustomerId = existing[0]?.stripe_customer_id ?? null;
    let cardSource;

    if (stripeCustomerId) {
      // Customer already exists on connected account — add new card as a source
      cardSource = await stripe.customers.createSource(
        stripeCustomerId,
        { source: token_id },
        { stripeAccount: orgStripeAccountId }
      );

      // Set this card as the default source
      await stripe.customers.update(
        stripeCustomerId,
        { default_source: cardSource.id },
        { stripeAccount: orgStripeAccountId }
      );
    } else {
      // Create new customer on the org's connected account with card token as source
      const customer = await stripe.customers.create(
        {
          email:  donor.email,
          name:   donor.name,
          source: token_id,
          metadata: {
            donor_id:        donorId.toString(),
            organization_id: organization_id.toString(),
          },
        },
        { stripeAccount: orgStripeAccountId }
      );

      stripeCustomerId = customer.id;
      // Retrieve the card source that was attached via the token
      cardSource = await stripe.customers.retrieveSource(
        stripeCustomerId,
        customer.default_source,
        { stripeAccount: orgStripeAccountId }
      );
    }

    // Build label from card source details
    const brand  = cardSource.brand  ?? '';
    const last4  = cardSource.last4  ?? '';
    const label  = brand && last4 ? `${brand} x${last4}` : 'Card';

    // Mark any previous card for this donor+org as non-default
    await prisma.$queryRaw`
      UPDATE donor_payment_methods
      SET is_default = 0
      WHERE donor_id       = ${donorId}
        AND organization_id = ${organization_id}
    `;

    // Save to DB — store the card Source ID (card_xxx) in stripe_payment_method_id
    await prisma.$queryRaw`
      INSERT INTO donor_payment_methods (
        donor_id,
        organization_id,
        stripe_customer_id,
        stripe_payment_method_id,
        label,
        card_brand,
        card_last4,
        card_exp_month,
        card_exp_year,
        is_default,
        status,
        created_at,
        updated_at
      ) VALUES (
        ${donorId},
        ${organization_id},
        ${stripeCustomerId},
        ${cardSource.id},
        ${label},
        ${brand || null},
        ${last4 || null},
        ${cardSource.exp_month ?? null},
        ${cardSource.exp_year  ?? null},
        1,
        'active',
        ${new Date()},
        ${new Date()}
      )
    `;

    console.log(`✅ Card saved on connected account ${orgStripeAccountId}: customer ${stripeCustomerId}, source ${cardSource.id} (${label})`);

    return NextResponse.json({
      success: true,
      payment_method: {
        stripe_customer_id:       stripeCustomerId,
        stripe_payment_method_id: cardSource.id,
        label,
        card_brand:     brand  || null,
        card_last4:     last4  || null,
        card_exp_month: cardSource.exp_month ?? null,
        card_exp_year:  cardSource.exp_year  ?? null,
      },
    });

  } catch (error) {
    console.error('Error saving payment method:', error);
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json({ success: false, error: 'Invalid token' }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
