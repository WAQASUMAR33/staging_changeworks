import { headers } from 'next/headers';
import { createStripeClient } from '@/app/lib/payment-mode';
import { corsHeaders } from '@/app/lib/cors';


/**
 * GHL Marketplace - Custom Payment Provider Webhook
 *
 * GHL calls this endpoint for every payment event in the location that has
 * your app installed as the active payment provider.
 *
 * Supported event types (sent in body.type):
 *   - PAYMENT_INITIATED   → create a Stripe PaymentIntent on the connected account
 *   - PAYMENT_REFUND      → issue a Stripe refund
 *   - PAYMENT_SUBSCRIPTION_CANCEL → cancel a Stripe subscription
 *
 * GHL expects a JSON response:
 *   { success: true, data: { paymentIntentId, clientSecret, ... } }
 */
export async function POST(req) {
  let body;
  try {
    const stripe = await createStripeClient();
    body = await req.json();
  } catch {
    return Response.json({ success: false, message: 'Invalid JSON body' }, { status: 400 });
  }

  const { type, locationId, amount, currency, description, metadata, paymentId } = body;

  if (!type || !locationId) {
    return Response.json(
      { success: false, message: 'Missing required fields: type, locationId' },
      { status: 400 }
    );
  }

  // TODO: look up the Stripe Connect account ID for this locationId from your DB
  const stripeAccountId = await getStripeAccountForLocation(locationId);
  if (!stripeAccountId) {
    return Response.json(
      { success: false, message: `No Stripe Connect account found for location ${locationId}` },
      { status: 404 }
    );
  }

  try {
    const stripe = await createStripeClient();
    switch (type) {
      case 'PAYMENT_INITIATED': {
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: Math.round((amount || 0) * 100), // convert to cents
            currency: (currency || 'usd').toLowerCase(),
            description: description || 'GHL Payment',
            metadata: { locationId, ghlPaymentId: paymentId, ...metadata },
            automatic_payment_methods: { enabled: true },
          },
          { stripeAccount: stripeAccountId }
        );

        console.log('Stripe PaymentIntent created', {
          id: paymentIntent.id,
          locationId,
          stripeAccountId,
        });

        return Response.json({
          success: true,
          data: {
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            status: paymentIntent.status,
          },
        });
      }

      case 'PAYMENT_REFUND': {
        const { paymentIntentId, refundAmount } = body;
        if (!paymentIntentId) {
          return Response.json(
            { success: false, message: 'paymentIntentId is required for refunds' },
            { status: 400 }
          );
        }

        const refund = await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            ...(refundAmount && { amount: Math.round(refundAmount * 100) }),
            metadata: { locationId, ghlPaymentId: paymentId },
          },
          { stripeAccount: stripeAccountId }
        );

        console.log('Stripe refund created', { id: refund.id, locationId });

        return Response.json({
          success: true,
          data: { refundId: refund.id, status: refund.status },
        });
      }

      case 'PAYMENT_SUBSCRIPTION_CANCEL': {
        const { subscriptionId } = body;
        if (!subscriptionId) {
          return Response.json(
            { success: false, message: 'subscriptionId is required to cancel subscription' },
            { status: 400 }
          );
        }

        const subscription = await stripe.subscriptions.cancel(subscriptionId, {
          stripeAccount: stripeAccountId,
        });

        console.log('Stripe subscription cancelled', { id: subscription.id, locationId });

        return Response.json({
          success: true,
          data: { subscriptionId: subscription.id, status: subscription.status },
        });
      }

      default:
        console.warn('Unknown GHL payment provider event type', type);
        return Response.json(
          { success: false, message: `Unsupported event type: ${type}` },
          { status: 422 }
        );
    }
  } catch (error) {
    console.error('GHL payment provider error', {
      type,
      locationId,
      stripeAccountId,
      message: error.message,
    });
    return Response.json(
      { success: false, message: 'Payment processing failed', error: error.message },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// Helper – replace with a real DB lookup
// ---------------------------------------------------------------------------
async function getStripeAccountForLocation(locationId) {
  // TODO: query your database for the Stripe Connect account linked to this GHL location
  // e.g. const record = await db.stripeConnections.findOne({ locationId });
  // return record?.stripeAccountId ?? null;
  return null;
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}
