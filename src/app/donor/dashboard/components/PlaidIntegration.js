'use client';

import { useState, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, X, Loader2, CheckCircle, AlertCircle, Building2 } from 'lucide-react';

const PlaidIntegration = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    setLoading(true);
    setError('');

    try {
      console.log('Plaid Link Success:', { publicToken, metadata });
      
      // Call your backend API to exchange public token for access token
      const response = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          public_token: publicToken,
          metadata: metadata
        })
      });

      if (!response.ok) {
        throw new Error('Failed to exchange token');
      }

      const result = await response.json();
      console.log('Token exchange successful:', result);
      
      setSuccess(true);
      
      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess(result);
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Plaid integration error:', err);
      setError('Failed to connect bank account. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onSuccess, onClose]);

  const onPlaidExit = useCallback((err, metadata) => {
    if (err) {
      console.error('Plaid Link Exit Error:', err);
      setError('Connection was cancelled or failed. Please try again.');
    }
  }, []);

  const config = {
    token: null, // We'll get this from our backend
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  };

  const { open, ready } = usePlaidLink(config);

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    try {
      // Get link token from backend
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to create link token');
      }

      const { link_token } = await response.json();
      
      // Update config with the link token
      config.token = link_token;
      
      // Open Plaid Link
      if (ready) {
        open();
      }
    } catch (err) {
      console.error('Error creating link token:', err);
      setError('Failed to initialize bank connection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Plaid Integration</h3>
                <p className="text-sm text-gray-600">Connect your bank account securely</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <X size={24} />
            </button>
          </div>

          {!success ? (
            <>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Building2 className="w-8 h-8 text-purple-600" />
                </div>
                <h4 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Bank Account</h4>
                <p className="text-gray-600 text-sm">
                  Securely link your bank account using Plaid to enable easy donations and account management.
                </p>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                <div className="p-3 bg-green-50 rounded-lg">
                  <h5 className="font-semibold text-green-800 text-sm mb-1">✓ Secure & Encrypted</h5>
                  <p className="text-xs text-green-700">Bank-level security with 256-bit encryption</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <h5 className="font-semibold text-blue-800 text-sm mb-1">✓ Read-Only Access</h5>
                  <p className="text-xs text-blue-700">We can only view your account, never make changes</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <h5 className="font-semibold text-purple-800 text-sm mb-1">✓ Instant Verification</h5>
                  <p className="text-xs text-purple-700">Verify your account instantly without waiting</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg">
                  <h5 className="font-semibold text-orange-800 text-sm mb-1">✓ Easy Management</h5>
                  <p className="text-xs text-orange-700">Manage your donations and subscriptions easily</p>
                </div>
              </div>

              <button
                onClick={handleConnect}
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Connecting to Plaid...</span>
                  </div>
                ) : (
                  'Connect Bank Account with Plaid'
                )}
              </button>

              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>Note:</strong> This will open Plaid Link in a secure popup window to connect your bank account.
                </p>
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Bank Account Connected!</h4>
              <p className="text-gray-600 mb-4">
                Your bank account has been successfully connected through Plaid.
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Returning to dashboard...</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PlaidIntegration;
