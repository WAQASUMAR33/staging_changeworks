'use client';

import { useState, useEffect } from 'react';
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

// Initialize Stripe once globally for the platform
let stripePromise = null;
if (typeof window !== 'undefined' && stripePublishableKey && stripePublishableKey.trim().startsWith('pk_')) {
  stripePromise = loadStripe(stripePublishableKey);
}

export default function StripeProvider({ children }) {
  // Handle missing key
  if (!stripePublishableKey || !stripePublishableKey.trim()) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
        <p className="text-red-700 font-semibold mb-2">Payment system not configured</p>
        <p className="text-red-600 text-sm">Stripe publishable key is missing.</p>
      </div>
    );
  }

  // Handle loading/failure
  if (!stripePromise) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[100px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p className="text-gray-500 text-sm font-medium">Initializing secure gateway...</p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      {children}
    </Elements>
  );
}
