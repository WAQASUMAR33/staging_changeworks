'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle, AlertCircle, CreditCard, Calendar, TrendingUp, Building2, ChevronRight, Star, Coffee, Zap, Package } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { buildOrgLogoUrl } from '@/lib/image-utils';

export default function StripeSubscriptionModal({ isOpen, onClose, onSuccess }) {
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrg, setSelectedOrg] = useState(null);
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(false);
  const [loadingPkgs, setLoadingPkgs] = useState(false);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentStep, setCurrentStep] = useState(1);

  // Fetch organizations
  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await fetch('/api/organizations/list');
      const data = await response.json();
      if (data.success) {
        setOrganizations(data.organizations || []);
      } else {
        setError('Failed to load organizations');
      }
    } catch (err) {
      setError('Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const [nonRecurringProducts, setNonRecurringProducts] = useState([]);

  // Fetch packages for selected organization
  const fetchOrgPackages = async (org) => {
    if (!org) return;
    try {
      setLoadingPkgs(true);
      setError('');
      setProducts([]);
      setNonRecurringProducts([]);
      const response = await fetch(`/api/stripe/organization-products?organization_id=${org.id}&stripe_account_id=${org.stripeAccountId || ''}`);
      const data = await response.json();
      console.log('ðŸ“¦ Org Products Data:', data);
      if (data.success) {
        setProducts(data.products || []);
        setNonRecurringProducts(data.nonRecurringProducts || []);
      } else {
        setError(data.error || 'This organization has no packages set up.');
      }
    } catch (err) {
      setError('Failed to load organization packages');
    } finally {
      setLoadingPkgs(false);
    }
  };

  // Create subscription
  const createSubscription = async (product) => {
    if (!selectedOrg || !product) return;

    try {
      setSubscriptionLoading(true);
      setError('');

      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) {
        setError('Please log in to continue.');
        return;
      }

      const response = await fetch('/api/subscriptions/create-connect-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          donor_id: parseInt(user.id),
          organization_id: selectedOrg.id,
          product_id: product.id,
          price_id: product.price.id
        }),
      });

      const data = await response.json();
      if (data.success && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        throw new Error(data.error || 'Failed to initialize subscription.');
      }
    } catch (err) {
      console.error('Error creating subscription:', err);
      setError(err.message || 'Failed to create subscription');
    } finally {
      setSubscriptionLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setCurrentStep(1);
      setSelectedOrg(null);
      setSelectedProduct(null);
      setProducts([]);
      fetchOrganizations();
    }
  }, [isOpen]);

  const formatPrice = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount / 100);
  };

  const handleNext = () => {
    if (currentStep === 1) setCurrentStep(2);
    else if (currentStep === 2 && selectedOrg) {
      fetchOrgPackages(selectedOrg);
      setCurrentStep(3);
    }
  };

  const handleBack = () => {
    if (currentStep === 2) setCurrentStep(1);
    else if (currentStep === 3) setCurrentStep(2);
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
        <p className="text-gray-600">Please read the following disclaimer before proceeding</p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-4">
          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-white text-sm font-bold">i</span>
          </div>
          <div className="text-sm text-blue-800 space-y-3">
            <p className="font-bold text-lg">Payment Processing:</p>
            <p>
              To process your donations securely, ChangeWorks uses Stripe to handle payment processing. Stripe is used by over 300,000 companies such as Amazon, DoorDash, and Shopify. Your banking information is collected only for verification and transaction purposes and is never shared with ChangeWorks or your chosen charity.
            </p>
          </div>
        </div>
      </div>

      <div className="text-center">
        <p className="text-sm text-gray-500">
          By clicking &quot;Next&quot;, you acknowledge that you have read and understood this disclaimer.
        </p>
      </div>
    </motion.div>
  );


  const renderOrgSelectionStep = () => {
    const filteredOrgs = organizations.filter(org =>
      org.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        className="space-y-6 flex flex-col h-full"
      >
        <div className="text-center mb-2">
          <h4 className="text-lg font-bold text-gray-900 mb-1">Select Organization</h4>
          <p className="text-sm text-gray-600">Choose which organization you&apos;d like to support</p>
        </div>

        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Building2 className="w-5 h-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search organizations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-2 border-gray-100 rounded-2xl text-gray-900 font-bold focus:border-blue-500 transition-all outline-none"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-3 min-h-[300px] max-h-[400px] pr-2 scrollbar-thin scrollbar-thumb-gray-200">
            {filteredOrgs.length > 0 ? (
              filteredOrgs.map(org => (
                <motion.div
                  key={org.id}
                  whileHover={{ y: -2, shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedOrg(org)}
                  className={`p-4 rounded-3xl cursor-pointer transition-all border-2 flex items-center space-x-5 ${selectedOrg?.id === org.id
                    ? 'border-blue-600 bg-blue-50/50 shadow-md shadow-blue-100'
                    : 'border-gray-50 bg-white hover:border-blue-200'
                    }`}
                >
                  <div className="w-14 h-14 bg-white rounded-2xl shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {org.imageUrl ? (
                      <Image
                        src={buildOrgLogoUrl(org.imageUrl)}
                        alt={org.name}
                        width={56}
                        height={56}
                        className="w-full h-full object-cover"
                      />
                    ) : <Building2 className="w-7 h-7 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-black text-gray-900 leading-tight">{org.name}</h4>
                    <div className="flex items-center mt-1 space-x-1">
                      <Star className="w-3 h-3 text-blue-600 fill-current" />
                      <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Verified Partner</p>
                    </div>
                  </div>
                  {selectedOrg?.id === org.id ? (
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center shadow-lg shadow-blue-200">
                      <CheckCircle className="w-5 h-5 text-white" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-full border-2 border-gray-100 flex items-center justify-center">
                      <ChevronRight className="w-4 h-4 text-gray-300" />
                    </div>
                  )}
                </motion.div>
              ))
            ) : (
              <div className="text-center py-12">
                <AlertCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">No organizations found matching &quot;{searchTerm}&quot;</p>
              </div>
            )}
          </div>
        )}
      </motion.div>
    );
  };

  const renderPackageSelectionStep = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center mb-6">
        <h4 className="text-lg font-bold text-gray-900 mb-2">Choose a Plan</h4>
        <p className="text-gray-600">Select a contribution package for {selectedOrg?.name}</p>
      </div>

      {loadingPkgs ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-700 font-medium">{error}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {products.length > 0 ? (
            products.map((product) => (
              <motion.div
                key={product.id}
                whileHover={{ y: -2, shadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
                whileTap={{ scale: 0.98 }}
                className={`relative border-2 rounded-3xl p-6 cursor-pointer transition-all duration-200 ${selectedProduct?.id === product.id
                  ? 'border-blue-600 bg-blue-50/50 shadow-md shadow-blue-100'
                  : 'border-gray-50 bg-white hover:border-blue-200'
                  }`}
                onClick={() => setSelectedProduct(product)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selectedProduct?.id === product.id ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                      }`}>
                      {product.name.includes('1') ? <Coffee className="w-6 h-6" /> :
                        product.name.includes('2') ? <Zap className="w-6 h-6" /> :
                          <Star className="w-6 h-6" />}
                    </div>
                    <div>
                      <h5 className="text-xl font-black text-gray-900">{product.name}</h5>
                      <p className="text-sm text-gray-500 font-medium line-clamp-1">{product.description}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-black text-gray-900">{formatPrice(product.price.unit_amount)}</p>
                    <p className="text-xs text-gray-400 font-black uppercase tracking-widest">/ Month</p>
                  </div>
                </div>
                {selectedProduct?.id === product.id && (
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center shadow-lg">
                    <CheckCircle className="w-4 h-4 text-white" />
                  </div>
                )}
              </motion.div>
            ))
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
              <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-bold text-gray-900 mb-2">No Recurring Packages Found</h3>
              <p className="text-gray-600 max-w-xs mx-auto text-sm mb-4">
                {nonRecurringProducts.length > 0
                  ? "We found existing donation products, but they aren't set up for recurring subscriptions."
                  : "This organization hasn't set up any donation packages yet."}
              </p>
              {nonRecurringProducts.length > 0 && (
                <div className="bg-blue-50 p-4 rounded-2xl text-blue-800 text-xs font-medium max-w-xs mx-auto">
                  Note: The organization needs to click &quot;Update to Recurring&quot; in their Stripe dashboard to enable subscriptions.
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </motion.div>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 backdrop-blur-md z-[100] flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-black text-gray-900">Setup Donation</h3>
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                  Step {currentStep} of 3
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-all"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 p-8 overflow-y-auto">
            <AnimatePresence mode="wait">
              {currentStep === 1 && renderDisclaimerStep()}
              {currentStep === 2 && renderOrgSelectionStep()}
              {currentStep === 3 && renderPackageSelectionStep()}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
            <div className="flex space-x-3">
              {currentStep > 1 && (
                <button
                  onClick={handleBack}
                  className="px-6 py-3 text-gray-600 font-bold hover:text-gray-900 transition-colors"
                >
                  Back
                </button>
              )}
              {currentStep === 1 && (
                <button
                  onClick={onClose}
                  className="px-6 py-3 text-gray-500 font-bold hover:text-gray-900 transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>

            <div className="flex space-x-3">
              {currentStep < 3 ? (
                <button
                  onClick={handleNext}
                  disabled={currentStep === 2 && !selectedOrg}
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center space-x-2"
                >
                  <span>Continue</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  onClick={() => createSubscription(selectedProduct)}
                  disabled={!selectedProduct || subscriptionLoading}
                  className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all flex items-center space-x-2"
                >
                  {subscriptionLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CreditCard className="w-5 h-5" />
                      <span>Start Subscription</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
