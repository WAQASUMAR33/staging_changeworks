'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Target, ArrowLeft, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PlaidConnectPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState('');

  const handlePlaidConnect = async () => {
    setLoading(true);
    setError('');

    try {
      // TODO: Implement Plaid Link integration
      console.log('Initiating Plaid Link...');
      
      // Simulate Plaid Link process
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // For demo purposes, simulate successful connection
      setConnected(true);
    } catch (err) {
      setError('Failed to connect bank account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <button
            onClick={() => router.back()}
            className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Dashboard</span>
          </button>
          
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center">
              <Target className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Plaid Integration</h1>
              <p className="text-gray-600">Connect your bank account securely</p>
            </div>
          </div>
        </motion.div>

        {/* Main Content */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {!connected ? (
              <>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Target className="w-10 h-10 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Your Bank Account</h2>
                  <p className="text-gray-600">
                    Securely link your bank account using Plaid to enable easy donations and account management.
                  </p>
                </div>

                {error && (
                  <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </div>
                )}

                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h3 className="font-semibold text-green-800 mb-2">✓ Secure & Encrypted</h3>
                      <p className="text-sm text-green-700">Bank-level security with 256-bit encryption</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h3 className="font-semibold text-blue-800 mb-2">✓ Read-Only Access</h3>
                      <p className="text-sm text-blue-700">We can only view your account, never make changes</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-lg">
                      <h3 className="font-semibold text-purple-800 mb-2">✓ Instant Verification</h3>
                      <p className="text-sm text-purple-700">Verify your account instantly without waiting</p>
                    </div>
                    <div className="p-4 bg-orange-50 rounded-lg">
                      <h3 className="font-semibold text-orange-800 mb-2">✓ Easy Management</h3>
                      <p className="text-sm text-orange-700">Manage your donations and subscriptions easily</p>
                    </div>
                  </div>

                  <button
                    onClick={handlePlaidConnect}
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
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
                </div>

                <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">
                    <strong>Note:</strong> This will integrate with Plaid Link for secure bank account connection. 
                    The actual Plaid integration will be implemented with your API keys.
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Bank Account Connected!</h2>
                <p className="text-gray-600 mb-6">
                  Your bank account has been successfully connected through Plaid.
                </p>
                <button
                  onClick={() => router.back()}
                  className="bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Return to Dashboard
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
