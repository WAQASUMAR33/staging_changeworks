'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SubscriptionSuccessPage() {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    
    if (sessionId) {
      handleSubscriptionSuccess(sessionId);
    } else {
      setStatus('error');
      setError('No session ID found');
    }
  }, [searchParams]);

  const handleSubscriptionSuccess = async (sessionId) => {
    try {
      setStatus('loading');
      setMessage('Processing your subscription...');

      // Get session details from Stripe
      const response = await fetch('/api/subscriptions/checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ session_id: sessionId }),
      });

      const data = await response.json();

      if (data.success) {
        setStatus('success');
        setMessage('Your subscription has been created successfully!');
        
        // Redirect to dashboard after 3 seconds
        setTimeout(() => {
          router.push('/donor/dashboard?subscription=success');
        }, 3000);
      } else {
        setStatus('error');
        setError(data.error || 'Failed to process subscription');
      }
    } catch (err) {
      console.error('Error processing subscription:', err);
      setStatus('error');
      setError('Failed to process subscription');
    }
  };

  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
      >
        {status === 'loading' && (
          <motion.div variants={itemVariants}>
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Processing Subscription</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
            </div>
          </motion.div>
        )}

        {status === 'success' && (
          <motion.div variants={itemVariants}>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Subscription Created!</h1>
            <p className="text-gray-600 mb-6">{message}</p>
            <div className="space-y-3">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <p className="text-sm text-green-700">
                  You will be redirected to your dashboard shortly.
                </p>
              </div>
              <button
                onClick={() => router.push('/donor/dashboard')}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
              >
                Go to Dashboard
              </button>
            </div>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div variants={itemVariants}>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Subscription Failed</h1>
            <p className="text-gray-600 mb-6">{error}</p>
            <div className="space-y-3">
              <button
                onClick={() => router.push('/donor/dashboard/subscriptions')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                Try Again
              </button>
              <button
                onClick={() => router.push('/donor/dashboard')}
                className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
              >
                Back to Dashboard
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
