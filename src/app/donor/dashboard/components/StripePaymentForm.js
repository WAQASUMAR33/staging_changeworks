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
  const [emailToast, setEmailToast] = useState(null); // { message: '', type: 'success' | 'error' }

  // Show loading state if Stripe is not ready
  if (!stripe || !elements) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Loading Payment Form.</h4>
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
        throw new Error('Please log in to make a payment.');
      }

      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: Math.round(parseFloat(amount) * 100), // send in cents
          currency: 'USD',
          donor_id: user.id,
          organization_id: parseInt(organization.id),
          description: message || `Donation to ${organization.name}`
        }),
      });

      const data = await response.json();

      if (!data.success) {
        const detailedError = data.details 
          ? `${data.error}: ${typeof data.details === 'object' ? JSON.stringify(data.details) : data.details}`
          : (data.error || 'Failed to create payment intent.');
        throw new Error(detailedError);
      }

      // Validate Environment Consistency (Client vs Server)
      const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
      const isClientLive = publishableKey.trim().startsWith('pk_live_');
      const isServerLive = data.livemode;

      if (publishableKey && isClientLive !== isServerLive) {
         console.error('Stripe Mode Mismatch:', { client: isClientLive ? 'Live' : 'Test', server: isServerLive ? 'Live' : 'Test' });
         throw new Error(`Configuration Error: Client is in ${isClientLive ? 'Live' : 'Test'} mode but Server is in ${isServerLive ? 'Live' : 'Test'} mode. Please check your deployment variables.`);
      }

      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        data.clientSecret,
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
        
        // Update the existing pending transaction record to completed status
        console.log('Updating transaction status for payment intent:', paymentIntent.id);
        
        // Use the existing payment confirm API which updates the pending record
        const confirmResponse = await fetch('/api/payments/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            payment_intent_id: paymentIntent.id,
          }),
        });

        const confirmData = await confirmResponse.json();
        console.log('Payment confirmation response:', confirmData);
        
        if (!confirmData.success) {
          console.error('Payment confirmation failed:', confirmData.error);
          // Don't throw error here as the payment was successful, just the confirmation failed
        } else if (confirmData.emailResult) {
            // Check email sending status
            if (confirmData.emailResult.sent) {
                setEmailToast({ message: 'Confirmation email sent!', type: 'success' });
            } else {
                console.error('Email sending failed:', confirmData.emailResult);
                setEmailToast({ message: 'Email sending failed.', type: 'error' });
            }
            
            // Clear toast after 10 seconds (giving enough time to read)
            setTimeout(() => setEmailToast(null), 10000);
        }

        // We rely on the Stripe Webhook to create the DonorTransaction record and send the email.
        // This prevents duplicate records and ensures backend-only email triggering.
        console.log('Payment confirmed. Waiting for webhook to process transaction and send email.');
        
        onSuccess(paymentIntent);
      } else {
        throw new Error('Payment was not successful.');
      }
    } catch (err) {
      console.error('Payment error:', err);
      
      let errorMessage = err.message;
      if (errorMessage.includes('No such payment_intent')) {
         const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
         const keyPrefix = publishableKey.substring(0, 8) + '...';
         errorMessage = `System Error: Payment configuration mismatch. Client Key: ${keyPrefix}. Please verify that your Deployment Environment Variables (STRIPE_SECRET_KEY and NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) belong to the SAME Stripe account and mode.`;
      }

      setError(errorMessage);
      setPaymentStatus('error');
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (paymentStatus === 'success') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center py-8 relative"
      >
        {/* Email Toast Notification */}
        {emailToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`absolute top-0 left-0 right-0 mx-auto w-max max-w-[90%] px-4 py-2 rounded-full shadow-lg flex items-center justify-center gap-2 text-sm font-medium ${
              emailToast.type === 'success' 
                ? 'bg-green-100 text-green-800 border border-green-200' 
                : 'bg-red-100 text-red-800 border border-red-200'
            }`}
          >
            {emailToast.type === 'success' ? (
                <CheckCircle className="w-4 h-4" />
            ) : (
                <AlertCircle className="w-4 h-4" />
            )}
            {emailToast.message}
          </motion.div>
        )}

        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h4>
        <p className="text-gray-600 mb-4">
          Your donation of ${amount} to {organization.name} has been processed successfully.
        </p>
        
        {/* Persistent Email Status Message */}
        {emailToast && (
             <p className={`text-sm mb-4 font-medium ${emailToast.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                {emailToast.type === 'success' 
                    ? 'A receipt has been sent to your email.' 
                    : 'We could not send the receipt email. Please contact support.'}
             </p>
        )}

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
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Payment Failed.</h4>
        <p className="text-gray-600 mb-4">
          {error || 'There was an error processing your payment. Please try again.'}
        </p>
        <div className="flex space-x-3">
          <button
            onClick={() => {
              setPaymentStatus('');
              setError('');
            }}
            className="flex-1 bg-[#0E0061] text-white py-3 px-4 rounded-xl font-semibold hover:bg-[#0C0055] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200"
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
        <h4 className="font-semibold text-gray-900 mb-2">Payment Summary.</h4>
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
          Card Information.
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
          className="flex-1 bg-[#0E0061] text-white py-3 px-4 rounded-xl font-semibold hover:bg-[#0C0055] focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
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
