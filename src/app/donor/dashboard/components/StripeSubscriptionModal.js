'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, CreditCard, Calendar, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function StripeSubscriptionModal({ isOpen, onClose, onSuccess }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  // Fetch Stripe products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError('');
      
      const response = await fetch('/api/stripe/products?limit=100&active=true');
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.products || []);
      } else {
        setError('Failed to load subscription products');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load subscription products');
    } finally {
      setLoading(false);
    }
  };

  // Create subscription
  const createSubscription = async (product) => {
    try {
      setSubscriptionLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      // Decode token to get donor ID
      const payload = JSON.parse(atob(token.split('.')[1]));
      const donorId = payload.id;

      // Get donor details to fetch organization_id
      const donorResponse = await fetch('/api/donor/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!donorResponse.ok) {
        setError('Failed to fetch donor information');
        return;
      }

      const donorData = await donorResponse.json();
      const organizationId = donorData.donor?.organization_id;

      if (!organizationId) {
        setError('Donor organization not found');
        return;
      }

      const response = await fetch('/api/subscriptions/create-from-stripe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          donor_id: donorId,
          product_id: product.id,
          price_id: product.prices[0].id, // Use the first price
          organization_id: organizationId, // Use donor's actual organization
        }),
      });

      const data = await response.json();
      
      console.log('🔍 Stripe Subscription Response:', data);
      
      if (data.success) {
        console.log('✅ Subscription creation successful');
        console.log('🔍 Checkout URL:', data.checkout_url);
        
        // Directly redirect to Stripe checkout without showing success message
        if (data.checkout_url) {
          console.log('🔄 Redirecting to Stripe checkout...');
          // Open checkout in same window to handle success callback
          window.location.href = data.checkout_url;
        } else {
          console.log('❌ No checkout URL received');
        }
        // Don't close modal immediately - let the redirect handle it
      } else {
        setError(data.error || 'Failed to create subscription');
      }
    } catch (err) {
      console.error('Error creating subscription:', err);
      setError('Failed to create subscription');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1); // Reset to disclaimer step
      setSubscriptionStatus(''); // Reset subscription status
      fetchProducts();
    }
  }, [isOpen]);

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const getIntervalText = (interval, intervalCount) => {
    if (intervalCount === 1) {
      return `per ${interval}`;
    }
    return `every ${intervalCount} ${interval}s`;
  };

  const handleNext = () => {
    setCurrentStep(2);
  };

  const handleBack = () => {
    setCurrentStep(1);
  };

  const renderDisclaimerStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-black mb-2">Important Information</h3>
        <p className="text-black">Please read the following disclaimer before proceeding</p>
      </div>

      {/* Disclaimer */}
      <div className="max-w-3xl mx-auto">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <div className="flex items-start space-x-4">
            <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-white text-sm font-bold">i</span>
            </div>
            <div className="text-sm text-blue-800 space-y-3">
              <p className="font-semibold text-lg mb-4">Disclaimer:</p>
              <p>
                To process your round-up donations securely, ChangeWorks uses Plaid to connect your bank account and Stripe to handle payment processing.
              </p>
              <p>
                Plaid is used by thousands of companies such as AMEX, Acorns, and Venmo. Stripe is used by over 300,000 companies such as Amazon, DoorDash, and Shopify.
              </p>
              <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 mt-4">
                <p className="font-semibold text-blue-900 text-base">
                  Your banking information is collected only for verification and transaction purposes and is never shared with ChangeWorks or your chosen charity.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-black">
          By clicking &quot;Next&quot;, you acknowledge that you have read and understood this disclaimer.
        </p>
      </div>
    </motion.div>
  );

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
          className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-900">Create Recurring Donations</h3>
                <p className="text-sm text-gray-600">Choose a recurring donation plan</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 pt-6 pb-4 overflow-y-auto max-h-[calc(90vh-140px)]">
            <AnimatePresence mode="wait">
              {currentStep === 1 && renderDisclaimerStep()}
              {currentStep === 2 && (
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                >
                  {loading ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
                        <p className="text-black">Loading subscription plans...</p>
                      </div>
                    </div>
                  ) : error ? (
                    <div className="text-center py-12">
                      <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-black mb-2">Error Loading Plans</h3>
                      <p className="text-black mb-4">{error}</p>
                      <button
                        onClick={fetchProducts}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                      >
                        Try Again
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="text-center mb-6">
                        <h4 className="text-lg font-semibold text-black mb-2">Available Plans</h4>
                        <p className="text-black">Choose a recurring donation plan that works for you</p>
                      </div>

                      {products.length > 0 ? (
                        <div className="grid gap-4 pb-0">
                          {products.map((product) => (
                            <motion.div
                              key={product.id}
                              whileHover={{ scale: 1.02 }}
                              className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 overflow-hidden ${
                                selectedProduct?.id === product.id
                                  ? 'border-green-500 bg-green-50'
                                  : 'border-gray-200 hover:border-green-300'
                              }`}
                              onClick={() => setSelectedProduct(product)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h5 className="text-lg font-semibold text-black">
                                      {product.name}
                                    </h5>
                                    <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                      {product.prices[0]?.recurring?.interval || 'monthly'}
                                    </span>
                                  </div>
                                  <p className="text-black mb-3">{product.description}</p>
                                  <div className="flex items-center space-x-4 text-sm text-black">
                                    <div className="flex items-center space-x-1">
                                      <CreditCard className="w-4 h-4" />
                                      <span>{formatPrice(product.prices[0]?.unit_amount || 0)}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                      <Calendar className="w-4 h-4" />
                                      <span>
                                        {getIntervalText(
                                          product.prices[0]?.recurring?.interval,
                                          product.prices[0]?.recurring?.interval_count
                                        )}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="ml-4">
                                  <div className="text-2xl font-bold text-black">
                                    {formatPrice(product.prices[0]?.unit_amount || 0)}
                                  </div>
                                  <div className="text-sm text-black">
                                    {getIntervalText(
                                      product.prices[0]?.recurring?.interval,
                                      product.prices[0]?.recurring?.interval_count
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-12">
                          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h3 className="text-lg font-semibold text-black mb-2">No Plans Available</h3>
                          <p className="text-black">No subscription plans are currently available.</p>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
            {currentStep === 1 ? (
              <>
                <div className="text-sm text-black">
                  Please read and acknowledge the disclaimer to continue
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-black hover:text-gray-800 transition-colors duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center space-x-2"
                  >
                    <span>Next</span>
                  </button>
                </div>
              </>
            ) : (
              <>
                {!loading && !error && products.length > 0 && (
                  <>
                    <div className="text-sm text-black">
                      {selectedProduct ? (
                        <span>
                          Selected: <strong>{selectedProduct.name}</strong> - {formatPrice(selectedProduct.prices[0]?.unit_amount || 0)} {getIntervalText(
                            selectedProduct.prices[0]?.recurring?.interval,
                            selectedProduct.prices[0]?.recurring?.interval_count
                          )}
                        </span>
                      ) : (
                        'Please select a subscription plan'
                      )}
                    </div>
                    <div className="flex space-x-3">
                      <button
                        onClick={handleBack}
                        className="px-4 py-2 text-black hover:text-gray-800 transition-colors duration-200"
                      >
                        Back
                      </button>
                      <button
                        onClick={() => createSubscription(selectedProduct)}
                        disabled={!selectedProduct || subscriptionLoading}
                        className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center space-x-2"
                      >
                        {subscriptionLoading ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Creating...</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="w-4 h-4" />
                            <span>Create Recurring Donation</span>
                          </>
                        )}
                      </button>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
