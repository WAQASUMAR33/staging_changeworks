'use client';

import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';

export default function StripeTest() {
  const stripe = useStripe();
  const elements = useElements();

  console.log('StripeTest - Stripe:', !!stripe, 'Elements:', !!elements);

  return (
    <div className="p-4 border border-gray-300 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">Stripe Test Component</h3>
      <p>Stripe loaded: {stripe ? 'Yes' : 'No'}</p>
      <p>Elements loaded: {elements ? 'Yes' : 'No'}</p>
      
      {elements && (
        <div className="mt-4">
          <label className="block text-sm font-medium mb-2">Test Card Input:</label>
          <div className="p-3 border border-gray-300 rounded">
            <CardElement 
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                  },
                },
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
