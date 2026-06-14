import Stripe from "stripe";

// Initialize Stripe with proper error handling
let stripe = null;

export function getStripe() {
  if (!stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error('STRIPE_SECRET_KEY environment variable is not set');
    }
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }
  return stripe;
}

export function isStripeConfigured() {
  return !!process.env.STRIPE_SECRET_KEY;
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
