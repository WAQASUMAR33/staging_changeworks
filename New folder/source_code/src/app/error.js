'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  RefreshCw, 
  Home, 
  Bug, 
  ArrowLeft,
  Mail,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';

export default function Error({ error, reset }) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [errorDetails, setErrorDetails] = useState('');

  useEffect(() => {
    // Log error details for debugging
    console.error('Application Error:', error);
    setErrorDetails(error?.message || 'An unexpected error occurred');
  }, [error]);

  const handleRetry = async () => {
    setIsRetrying(true);
    
    // Add a small delay for better UX
    setTimeout(() => {
      reset();
      setIsRetrying(false);
    }, 1000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-orange-50 to-yellow-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full text-center">
        {/* Error Icon Animation */}
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
          className="mb-8"
        >
          <div className="relative inline-block">
            <motion.div
              animate={{ 
                boxShadow: [
                  "0 0 0 0 rgba(239, 68, 68, 0.4)",
                  "0 0 0 20px rgba(239, 68, 68, 0)",
                  "0 0 0 0 rgba(239, 68, 68, 0)"
                ]
              }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center"
            >
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </motion.div>
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="absolute -top-2 -right-2"
            >
              <Bug className="w-8 h-8 text-orange-500" />
            </motion.div>
          </div>
        </motion.div>

        {/* Error Message */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mb-8"
        >
          <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-4">
            Oops! Something went wrong
          </h1>
          <p className="text-lg text-gray-600 mb-6 max-w-lg mx-auto">
            We encountered an unexpected error. Don&apos;t worry, our team has been notified and we&apos;re working to fix it.
          </p>
          
          {/* Error Details (Development) */}
          {process.env.NODE_ENV === 'development' && errorDetails && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="bg-red-50 border border-red-200 rounded-lg p-4 text-left max-w-lg mx-auto mb-6"
            >
              <h3 className="text-sm font-semibold text-red-800 mb-2 flex items-center">
                <Bug className="w-4 h-4 mr-2" />
                Error Details (Development)
              </h3>
              <code className="text-xs text-red-700 break-all">
                {errorDetails}
              </code>
            </motion.div>
          )}
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRetry}
            disabled={isRetrying}
            className="inline-flex items-center px-6 py-3 bg-red-600 text-white font-semibold rounded-lg shadow-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            <motion.div
              animate={isRetrying ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: isRetrying ? Infinity : 0, ease: "linear" }}
            >
              <RefreshCw className="w-5 h-5 mr-2" />
            </motion.div>
            {isRetrying ? 'Retrying...' : 'Try Again'}
          </motion.button>
          
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center px-6 py-3 bg-white text-gray-700 font-semibold rounded-lg shadow-lg border border-gray-300 hover:bg-gray-50 transition-colors duration-200"
            >
              <Home className="w-5 h-5 mr-2" />
              Go Home
            </motion.button>
          </Link>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => window.history.back()}
            className="inline-flex items-center px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg shadow-lg hover:bg-gray-700 transition-colors duration-200"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Go Back
          </motion.button>
        </motion.div>

        {/* Help Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="bg-white rounded-xl shadow-lg border border-gray-200 p-6"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Still having trouble?
          </h3>
          <p className="text-gray-600 mb-6">
            If the problem persists, please contact our support team with details about what you were trying to do.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="mailto:support@changeworksfund.org?subject=Error Report&body=I encountered an error on the ChangeWorks platform."
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors duration-200"
            >
              <Mail className="w-4 h-4 mr-2" />
              Report Issue
            </a>
            
            <Link href="/help">
              <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors duration-200 cursor-pointer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Help Center
              </span>
            </Link>
          </div>
        </motion.div>

        {/* Error ID for Support */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.6 }}
          className="mt-8"
        >
          <p className="text-xs text-gray-400">
            Error ID: {Date.now().toString(36).toUpperCase()} • 
            Timestamp: {new Date().toISOString()}
          </p>
        </motion.div>
      </div>
    </div>
  );
}
