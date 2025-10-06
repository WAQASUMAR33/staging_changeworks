'use client';

import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

// Get the Stripe publishable key from environment variables
// In client-side code, only NEXT_PUBLIC_ prefixed variables are available
const stripePublishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// Debug logging for environment variables
console.log('Environment check:', {
  hasStripeKey: !!stripePublishableKey,
  keyLength: stripePublishableKey?.length || 0,
  keyPrefix: stripePublishableKey?.substring(0, 10) || 'none',
  allEnvKeys: Object.keys(process.env).filter(key => key.includes('STRIPE'))
});

// Initialize Stripe with proper error handling
let stripePromise = null;

if (stripePublishableKey && stripePublishableKey.trim()) {
  try {
    // Validate the key format (should start with pk_)
    if (stripePublishableKey.startsWith('pk_')) {
      stripePromise = loadStripe(stripePublishableKey);
      console.log('Stripe initialized successfully');
    } else {
      console.error('Invalid Stripe publishable key format. Should start with "pk_"');
    }
  } catch (error) {
    console.error('Error initializing Stripe:', error);
  }
} else {
  console.error('Stripe publishable key is missing or empty');
}

export default function StripeProvider({ children }) {
  // Check if Stripe publishable key is available
  if (!stripePublishableKey || !stripePublishableKey.trim()) {
    console.error('Stripe publishable key not found. Please check NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY environment variable.');
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center">
          <p className="text-red-700 font-semibold mb-2">Payment system not configured</p>
          <p className="text-red-600 text-sm">
            Stripe publishable key is missing. Please contact support or check environment configuration.
          </p>
          <details className="mt-2 text-xs text-gray-600">
            <summary className="cursor-pointer">Debug Info</summary>
            <div className="mt-1 p-2 bg-gray-100 rounded text-left">
              <p>Environment: {process.env.NODE_ENV}</p>
              <p>Has Stripe Key: {stripePublishableKey ? 'Yes' : 'No'}</p>
              <p>Key Length: {stripePublishableKey?.length || 0}</p>
            </div>
          </details>
        </div>
      </div>
    );
  }

  // Check if Stripe was initialized successfully
  if (!stripePromise) {
    console.error('Failed to initialize Stripe');
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <div className="text-center">
          <p className="text-red-700 font-semibold mb-2">Payment system initialization failed</p>
          <p className="text-red-600 text-sm">
            There was an error initializing the payment system. Please try again.
          </p>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
