'use client';

import { useState } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { motion } from 'framer-motion';
import { 
  Loader2, 
  CreditCard,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#000000',
      '::placeholder': {
        color: '#666666',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

export default function PaymentConfirmationStep({ 
  amount, 
  organization, 
  onSuccess, 
  onError,
  onBack 
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get donor info from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('🔍 PaymentConfirmationStep - User data:', user);
      
      if (!user.id) {
        throw new Error('Please log in to make a payment');
      }

      // Create payment intent
      // Note: This endpoint creates the intent on the Connected Account (Direct Charge)
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: Math.round(parseFloat(amount) * 100), // send in cents
          currency: 'USD',
          donor_id: parseInt(user.id),
          organization_id: organization.id,
          description: `Donation to ${organization.name}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        const detailedError = errorData.details 
          ? `${errorData.error}: ${typeof errorData.details === 'object' ? JSON.stringify(errorData.details) : errorData.details}`
          : (errorData.error || 'Failed to create payment intent');
        throw new Error(detailedError);
      }

      const { client_secret } = await response.json();

      // Confirm payment
      console.log('💳 Starting card confirmation...');
      const cardElement = elements.getElement(CardElement);
      
      // Since we are inside a StripeProvider initialized with the connected account,
      // confirmCardPayment will automatically use the correct account context.
      const result = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
          billing_details: {
            name: user.name || 'Donor',
            email: user.email,
          },
        },
        return_url: window.location.href,
      });

      console.log('📨 Stripe confirmation result:', result);

      const { error: stripeError, paymentIntent } = result;

      if (stripeError) {
        console.error('❌ Payment Confirmation Failed:', stripeError);
        throw new Error(stripeError.message);
      }

      if (paymentIntent) {
        console.log(`✅ Payment Intent Status: ${paymentIntent.status}`);
        
        if (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing') {
          
          // Call backend to confirm transaction and trigger email
          let emailStatus = null;
          try {
             console.log('🔄 Calling backend to confirm payment and send email...');
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
             console.log('📬 Payment confirmation response:', confirmData);
             
             if (confirmData.emailResult) {
                 emailStatus = confirmData.emailResult;
             }
          } catch (confirmError) {
             console.error('❌ Error confirming payment on backend:', confirmError);
             // Don't block success flow, but log it
          }

          setPaymentStatus('success');
          // Pass both paymentIntent and emailStatus to the parent
          onSuccess({ paymentIntent, emailStatus });
        } else {
          console.warn(`⚠️ Payment not succeeded. Status: ${paymentIntent.status}`);
          throw new Error(`Payment status is ${paymentIntent.status}. Please try again.`);
        }
      } else {
        throw new Error('No payment response received');
      }

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setPaymentStatus('error');
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state if Stripe is not ready
  if (!stripe || !elements) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Initializing Payment</h4>
        <p className="text-gray-600 mb-4">
          Connecting to secure payment gateway...
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-xl font-semibold text-black mb-2">Complete Payment</h3>
        <p className="text-black">Enter your payment details to complete the donation.</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Error Display */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        {/* Donation Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-black mb-3">Donation Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-black">Amount:</span>
              <span className="font-semibold">${amount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-black">Organization:</span>
              <span className="font-semibold text-right max-w-48 truncate">{organization?.name}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-black">Total:</span>
                <span className="font-bold text-lg text-blue-600">${amount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Card Element */}
        <div>
          <label className="block text-sm font-semibold text-black mb-2">
            Payment Information *
          </label>
          <div className="p-4 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all duration-200">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center pt-6 border-t border-gray-200">
          <button
            onClick={onBack}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200 disabled:opacity-50"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-black">Back</span>
          </button>

          <button
            onClick={handleSubmit}
            disabled={loading || !stripe || !elements}
            className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-white">Processing...</span>
              </>
            ) : (
              <>
                <span className="text-white">Complete Donation</span>
                <CheckCircle className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
