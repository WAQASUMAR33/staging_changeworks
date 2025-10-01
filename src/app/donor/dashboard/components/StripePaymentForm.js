'use client';

import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle, X } from 'lucide-react';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
    },
  },
};

export default function StripePaymentForm({ 
  amount, 
  organization, 
  message, 
  onSuccess, 
  onError, 
  onCancel 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(''); // 'processing', 'success', 'error'

  // Show loading state if Stripe is not ready
  if (!stripe || !elements) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Loading Payment Form</h4>
        <p className="text-gray-600 mb-4">
          Please wait while we initialize the secure payment system...
        </p>
      </div>
    );
  }

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setLoading(true);
    setError('');
    setPaymentStatus('processing');

    try {
      // Get donor info from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) {
        throw new Error('Please log in to make a payment');
      }

      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(amount),
          currency: 'USD',
          donor_id: user.id,
          organization_id: parseInt(organization.id),
          description: message || `Donation to ${organization.name}`
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment intent');
      }

      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        data.client_secret,
        {
          payment_method: {
            card: elements.getElement(CardElement),
            billing_details: {
              name: user.name,
              email: user.email,
            },
          }
        }
      );

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent.status === 'succeeded') {
        setPaymentStatus('success');
        
        // Save transaction record using the correct API
        const transactionResponse = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            trx_id: paymentIntent.id,
            trx_date: new Date().toISOString(),
            trx_amount: parseFloat(amount),
            trx_method: 'stripe',
            trx_donor_id: user.id,
            trx_organization_id: parseInt(organization.id),
            pay_status: 'completed',
            trx_recipt_url: paymentIntent.receipt_url || null,
            trx_details: JSON.stringify({
              payment_intent_id: paymentIntent.id,
              description: message || `Donation to ${organization.name}`,
              stripe_metadata: {
                payment_intent_id: paymentIntent.id,
                amount: paymentIntent.amount,
                currency: paymentIntent.currency,
                status: paymentIntent.status
              }
            })
          }),
        });

        const transactionData = await transactionResponse.json();
        
        if (!transactionData.success) {
          console.error('Transaction save failed:', transactionData.error);
        }

        onSuccess(paymentIntent);
      } else {
        throw new Error('Payment was not successful');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message);
      setPaymentStatus('error');
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (paymentStatus === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8"
      >
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h4>
        <p className="text-gray-600 mb-4">
          Your donation of ${amount} to {organization.name} has been processed successfully.
        </p>
        <button
          onClick={onCancel}
          className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-200"
        >
          Close
        </button>
      </motion.div>
    );
  }

  if (paymentStatus === 'error') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8"
      >
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Payment Failed</h4>
        <p className="text-gray-600 mb-4">
          {error || 'There was an error processing your payment. Please try again.'}
        </p>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setPaymentStatus('');
              setError('');
            }}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
          >
            Try Again
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-gray-500 text-white py-3 px-4 rounded-xl font-semibold hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500/50 transition-all duration-200"
          >
            Cancel
          </button>
        </div>
      </motion.div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-semibold text-gray-900 mb-2">Payment Summary</h4>
        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Amount:</span>
            <span className="font-semibold">${amount}</span>
          </div>
          <div className="flex justify-between">
            <span>Organization:</span>
            <span className="font-semibold">{organization.name}</span>
          </div>
          {message && (
            <div className="flex justify-between">
              <span>Message:</span>
              <span className="font-semibold">{message}</span>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Card Information
        </label>
        <div className="p-4 border-2 border-gray-200 rounded-xl focus-within:border-blue-500 transition-colors duration-200 bg-white">
          <CardElement 
            options={CARD_ELEMENT_OPTIONS}
            onChange={(event) => {
              if (event.error) {
                setError(event.error.message);
              } else {
                setError('');
              }
            }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Enter your card details securely. We use Stripe to process payments.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <div className="flex space-x-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:border-gray-300 transition-all duration-200"
          disabled={loading}
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading || !stripe}
          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </div>
          ) : (
            `Pay $${amount}`
          )}
        </button>
      </div>
    </form>
  );
}
