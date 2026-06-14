'use client';

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements } from '@stripe/react-stripe-js';

let _cachedPromise = null;
let _cachedKey = null;

async function loadStripeForMode(stripeAccount) {
  const res = await fetch('/api/config/payment-mode');
  const { stripePublishableKey } = await res.json();
  if (!stripePublishableKey?.startsWith('pk_')) return null;

  if (stripeAccount) {
    return loadStripe(stripePublishableKey, { stripeAccount });
  }
  // Reuse platform promise if key hasn't changed
  if (_cachedKey !== stripePublishableKey) {
    _cachedKey = stripePublishableKey;
    _cachedPromise = loadStripe(stripePublishableKey);
  }
  return _cachedPromise;
}

export default function StripeProvider({ children, stripeAccount }) {
  const [stripePromise, setStripePromise] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadStripeForMode(stripeAccount)
      .then((p) => {
        if (!p) setError('Stripe publishable key not configured');
        else setStripePromise(p);
      })
      .catch(() => setError('Failed to load payment configuration'));
  }, [stripeAccount]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-center">
        <p className="text-red-700 font-semibold mb-2">Payment system not configured.</p>
        <p className="text-red-600 text-sm">{error}</p>
      </div>
    );
  }

  if (!stripePromise) {
    return (
      <div className="p-4 flex flex-col items-center justify-center min-h-[100px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p className="text-gray-500 text-sm font-medium">Initializing secure gateway...</p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise} key={stripeAccount || 'platform'}>
      {children}
    </Elements>
  );
}
