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
          organization_id: 1, // Default organization
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setSubscriptionStatus('success');
        // Redirect to Stripe checkout
        if (data.checkout_url) {
          window.open(data.checkout_url, '_blank');
        }
        setTimeout(() => {
          onSuccess && onSuccess(data);
          onClose();
        }, 2000);
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
                <h3 className="text-xl font-bold text-gray-900">Create Subscription</h3>
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
          <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600 mx-auto mb-4" />
                  <p className="text-gray-600">Loading subscription plans...</p>
                </div>
              </div>
            ) : error ? (
              <div className="text-center py-12">
                <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Plans</h3>
                <p className="text-gray-600 mb-4">{error}</p>
                <button
                  onClick={fetchProducts}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Try Again
                </button>
              </div>
            ) : subscriptionStatus === 'success' ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 mb-2">Subscription Created!</h3>
                <p className="text-gray-600 mb-4">
                  You will be redirected to complete your subscription setup.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-2">Available Plans</h4>
                  <p className="text-gray-600">Choose a recurring donation plan that works for you</p>
                </div>

                {products.length > 0 ? (
                  <div className="grid gap-4">
                    {products.map((product) => (
                      <motion.div
                        key={product.id}
                        whileHover={{ scale: 1.02 }}
                        className={`border-2 rounded-xl p-6 cursor-pointer transition-all duration-200 ${
                          selectedProduct?.id === product.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-green-300'
                        }`}
                        onClick={() => setSelectedProduct(product)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-2">
                              <h5 className="text-lg font-semibold text-gray-900">
                                {product.name}
                              </h5>
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                {product.prices[0]?.recurring?.interval || 'monthly'}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-3">{product.description}</p>
                            <div className="flex items-center space-x-4 text-sm text-gray-500">
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
                            <div className="text-2xl font-bold text-gray-900">
                              {formatPrice(product.prices[0]?.unit_amount || 0)}
                            </div>
                            <div className="text-sm text-gray-500">
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
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">No Plans Available</h3>
                    <p className="text-gray-600">No subscription plans are currently available.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          {!loading && !error && subscriptionStatus !== 'success' && products.length > 0 && (
            <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
              <div className="text-sm text-gray-600">
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
                  onClick={onClose}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                >
                  Cancel
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
                      <span>Subscribe</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
