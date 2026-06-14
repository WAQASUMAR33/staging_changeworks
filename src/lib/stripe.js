import { createStripeClient, getStripePublishableKey } from '@/app/lib/payment-mode';

/**
 * Returns a mode-aware Stripe instance (sandbox or live depending on DB setting).
 * All route handlers should call this inside the handler, not at module level.
 */
export async function getStripe() {
  return createStripeClient();
}

export async function getPublishableKey() {
  return getStripePublishableKey();
}

export function isStripeConfigured() {
  return !!(process.env.STRIPE_SECRET_KEY_SANDBOX || process.env.STRIPE_SECRET_KEY_LIVE);
}

export function handleStripeError(error, context = 'Stripe operation') {
  console.error(`${context} error:`, error.message);

  if (error.type === 'StripeCardError') {
    return { error: 'Your card was declined.', status: 400 };
  } else if (error.type === 'StripeRateLimitError') {
    return { error: 'Too many requests. Please try again later.', status: 429 };
  } else if (error.type === 'StripeInvalidRequestError') {
    return { error: 'Invalid request. Please check your data.', status: 400 };
  } else if (error.type === 'StripeAPIError') {
    return { error: 'Payment service error. Please try again.', status: 502 };
  } else if (error.type === 'StripeConnectionError') {
    return { error: 'Network error. Please check your connection.', status: 503 };
  } else if (error.type === 'StripeAuthenticationError') {
    return { error: 'Payment service authentication failed.', status: 503 };
  } else {
    return { error: 'An unexpected error occurred.', status: 500 };
  }
}
