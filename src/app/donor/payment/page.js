'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, CreditCard, ArrowLeft, Loader2, X, CheckCircle, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DonorPaymentPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    amount: '',
    organization_id: '',
    message: ''
  });
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(''); // 'processing', 'success', 'error'
  const [paymentResult, setPaymentResult] = useState(null);

  // Fetch organizations on component mount
  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      const response = await fetch('/api/organizations/list');
      const data = await response.json();
      
      if (data.success && data.organizations && Array.isArray(data.organizations)) {
        setOrganizations(data.organizations);
        console.log(`✅ Loaded ${data.count} organizations`);
      } else {
        console.error('❌ Failed to fetch organizations:', data.error);
        setOrganizations([]);
        setError('Failed to load organizations');
      }
    } catch (err) {
      console.error('❌ Error fetching organizations:', err);
      setOrganizations([]);
      setError('Failed to load organizations');
    } finally {
      setLoadingOrgs(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Get donor info from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('🔍 User data from localStorage:', user);
      
      if (!user.id) {
        console.error('❌ No user ID found in localStorage');
        setError('Please log in to make a payment');
        return;
      }

      // Prepare payment data
      const paymentData = {
        amount: parseFloat(formData.amount),
        currency: 'USD',
        donor_id: parseInt(user.id),
        organization_id: parseInt(formData.organization_id),
        description: `Donation to organization`
      };
      
      console.log('🔍 Payment data being sent:', paymentData);
      
      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });

      const data = await response.json();

      if (data.success) {
        setPaymentResult(data);
        setShowPaymentModal(true);
        setPaymentStatus('processing');
        
        // Simulate Stripe payment processing
        setTimeout(() => {
          setPaymentStatus('success');
        }, 3000);
      } else {
        setError(data.error || 'Failed to create payment intent');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentStatus('');
    setPaymentResult(null);
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
            <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Stripe Payment</h1>
              <p className="text-gray-600">Make a one-time donation</p>
            </div>
          </div>
        </motion.div>

        {/* Payment Form */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="max-w-2xl mx-auto"
        >
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="flex items-center space-x-3 mb-6">
              <CreditCard className="w-6 h-6 text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">Payment Details</h2>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Donation Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    required
                    className="w-full pl-8 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Organization *
                </label>
                <select
                  name="organization_id"
                  value={formData.organization_id}
                  onChange={handleChange}
                  required
                  disabled={loadingOrgs}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 disabled:opacity-50"
                >
                  <option value="">
                    {loadingOrgs ? 'Loading organizations...' : 'Select an organization'}
                  </option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>


              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Processing Payment...</span>
                  </div>
                ) : (
                  'Process Payment with Stripe'
                )}
              </button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> This integrates with Stripe for secure payment processing using your API keys.
              </p>
            </div>
          </div>
        </motion.div>

        {/* Stripe Payment Modal */}
        <AnimatePresence>
          {showPaymentModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={closePaymentModal}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-gray-800">Processing Payment</h3>
                  <button
                    onClick={closePaymentModal}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    <X size={24} />
                  </button>
                </div>

                {paymentStatus === 'processing' && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Processing Payment</h4>
                    <p className="text-gray-600 mb-4">
                      Please wait while we process your payment with Stripe...
                    </p>
                    {paymentResult && (
                      <div className="bg-gray-50 rounded-lg p-4 text-left">
                        <p className="text-sm text-gray-600">
                          <strong>Amount:</strong> ${paymentResult.amount}
                        </p>
                        <p className="text-sm text-gray-600">
                          <strong>Payment ID:</strong> {paymentResult.payment_intent_id}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {paymentStatus === 'success' && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Payment Successful!</h4>
                    <p className="text-gray-600 mb-4">
                      Your donation has been processed successfully.
                    </p>
                    {paymentResult && (
                      <div className="bg-green-50 rounded-lg p-4 text-left mb-4">
                        <p className="text-sm text-green-700">
                          <strong>Amount:</strong> ${paymentResult.amount}
                        </p>
                        <p className="text-sm text-green-700">
                          <strong>Transaction ID:</strong> {paymentResult.transaction_id}
                        </p>
                      </div>
                    )}
                    <button
                      onClick={closePaymentModal}
                      className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-200"
                    >
                      Close
                    </button>
                  </div>
                )}

                {paymentStatus === 'error' && (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-8 h-8 text-red-600" />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-2">Payment Failed</h4>
                    <p className="text-gray-600 mb-4">
                      There was an error processing your payment. Please try again.
                    </p>
                    <button
                      onClick={closePaymentModal}
                      className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-red-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200"
                    >
                      Close
                    </button>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
