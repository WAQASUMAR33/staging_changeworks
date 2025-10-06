'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, AlertCircle, Loader2, Mail } from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function DonorVerifyPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('verifying'); // 'verifying', 'success', 'error'
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setStatus('error');
      setMessage('No verification token provided');
      setLoading(false);
      return;
    }

    verifyEmail(token);
  }, [searchParams, verifyEmail]);

  const verifyEmail = useCallback(async (token) => {
    try {
      const response = await fetch('/api/donor/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage('Your email has been verified successfully! You can now sign in to your account.');
        setTimeout(() => {
          router.push('/donor/login');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Email verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
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
        className="w-full max-w-md"
      >
        <motion.div variants={itemVariants} className="bg-white rounded-2xl shadow-xl p-8 text-center">
          {loading && (
            <>
              <motion.div
                variants={itemVariants}
                className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verifying Your Email</h1>
              <p className="text-gray-600">Please wait while we verify your email address...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <motion.div
                variants={itemVariants}
                className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <CheckCircle className="w-8 h-8 text-green-600" />
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Email Verified!</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <motion.button
                variants={itemVariants}
                onClick={() => router.push('/donor/login')}
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
              >
                Go to Sign In
              </motion.button>
            </>
          )}

          {status === 'error' && (
            <>
              <motion.div
                variants={itemVariants}
                className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6"
              >
                <AlertCircle className="w-8 h-8 text-red-600" />
              </motion.div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Verification Failed</h1>
              <p className="text-gray-600 mb-6">{message}</p>
              <div className="space-y-3">
                <motion.button
                  variants={itemVariants}
                  onClick={() => window.location.reload()}
                  className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Try Again
                </motion.button>
                <motion.button
                  variants={itemVariants}
                  onClick={() => router.push('/donor/signup')}
                  className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                >
                  Back to Sign Up
                </motion.button>
              </div>
            </>
          )}
        </motion.div>
      </motion.div>
    </div>
  );
}
