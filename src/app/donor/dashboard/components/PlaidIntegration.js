'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, X, Loader2, CheckCircle, AlertCircle, Building2, Search, Heart, ArrowLeft, ArrowRight, CreditCard } from 'lucide-react';
import { buildOrgLogoUrl } from '@/lib/image-utils';
import Image from 'next/image';

// Stripe promise loaded dynamically from /api/config/payment-mode (mode-aware)
let stripePromise = fetch('/api/config/payment-mode')
  .then((r) => r.json())
  .then(({ stripePublishableKey }) => stripePublishableKey?.startsWith('pk_') ? loadStripe(stripePublishableKey) : null)
  .catch(() => null);

// ─── Card collection form ─────────────────────────────────────────────────────
const CardForm = ({ onSaved, onError, token, organizationId }) => {
  const stripe   = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSaving(true);
    onError('');

    try {
      const cardElement = elements.getElement(CardElement);

      // Create a token — tokens can be used as sources on connected accounts
      const { error, token: cardToken } = await stripe.createToken(cardElement);

      if (error) {
        onError(error.message);
        return;
      }

      // Save card on the org's Stripe connected account
      const res = await fetch('/api/stripe/save-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ token_id: cardToken.id, organization_id: organizationId }),
      });

      const data = await res.json();
      if (!data.success) {
        onError(data.error || 'Failed to save card');
        return;
      }

      onSaved(data.payment_method);
    } catch (err) {
      onError('Failed to save card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-gray-300 rounded-lg bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all duration-200">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                '::placeholder': { color: '#9ca3af' },
              },
              invalid: { color: '#ef4444' },
            },
          }}
        />
      </div>
      <button
        type="submit"
        disabled={saving || !stripe}
        className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
      >
        {saving ? (
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Saving card...</span>
          </div>
        ) : (
          'Save Card as Funding Source'
        )}
      </button>
    </form>
  );
};

// ─── Main component ───────────────────────────────────────────────────────────
const PlaidIntegration = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [connectionResult, setConnectionResult] = useState(null);
  const [savedCard, setSavedCard] = useState(null);
  // Steps: 1=Disclaimer, 2=Select Org, 3=Add Card, 4=Connect Bank
  const [currentStep, setCurrentStep] = useState(1);

  // Organization selection state
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Persist selected organization in localStorage
  useEffect(() => {
    if (selectedOrganization) {
      localStorage.setItem('plaid-selected-org', JSON.stringify(selectedOrganization));
    }
  }, [selectedOrganization]);

  // Restore selected organization from localStorage on mount
  useEffect(() => {
    const savedOrg = localStorage.getItem('plaid-selected-org');
    if (savedOrg) {
      try {
        setSelectedOrganization(JSON.parse(savedOrg));
      } catch {
        localStorage.removeItem('plaid-selected-org');
      }
    }
  }, []);

  // Fetch organizations when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    } else {
      localStorage.removeItem('plaid-selected-org');
    }
  }, [isOpen]);

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      const response = await fetch('/api/organizations/list');
      const data = await response.json();
      if (data.success && Array.isArray(data.organizations)) {
        setOrganizations(data.organizations);
      } else {
        setOrganizations([]);
      }
    } catch {
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    setLoading(true);
    setError('');

    try {
      let currentOrg = selectedOrganization;
      if (!currentOrg?.id) {
        const savedOrg = localStorage.getItem('plaid-selected-org');
        if (savedOrg) {
          try { currentOrg = JSON.parse(savedOrg); setSelectedOrganization(currentOrg); } catch { /**/ }
        }
        if (!currentOrg?.id) throw new Error('Organization selection lost. Please try again.');
      }

      const token = localStorage.getItem('token');
      if (!token) throw new Error('Authentication token lost. Please log in again.');

      const decoded = JSON.parse(atob(token.split('.')[1]));
      const donorId = decoded.id;

      const response = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          public_token: publicToken,
          metadata,
          organization_id: currentOrg.id,
          donor_id: donorId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.clone().json().catch(() => ({ error: 'Unknown error' }));
        console.error('Token exchange failed:', errorData);
        throw new Error('Failed to exchange token');
      }

      const result = await response.json();
      setConnectionResult(result.connection || null);

      // Bank is the final step — go straight to success screen
      setSuccess(true);
      setTimeout(() => {
        onSuccess({ connection: result.connection, payment_method: savedCard });
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Plaid integration error:', err);
      setError('Failed to connect bank account. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [selectedOrganization]);

  const onPlaidExit = useCallback((err) => {
    if (err) {
      if (err.error_code === 'NO_AUTH_ACCOUNTS') {
        setError("No checking or savings account found. Please make sure you're logging in with a bank account that has an active checking or savings account.");
      } else if (err.error_code === 'INSTITUTION_NOT_SUPPORTED') {
        setError('This institution is not supported. Please try a different bank.');
      } else {
        setError('Connection was cancelled or failed. Please try again.');
      }
    }
  }, []);

  const [linkToken, setLinkToken] = useState(null);
  const config = { token: linkToken, onSuccess: onPlaidSuccess, onExit: onPlaidExit };
  const { open, ready } = usePlaidLink(config);

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    try {
      let currentOrg = selectedOrganization;
      if (!currentOrg?.id) {
        const savedOrg = localStorage.getItem('plaid-selected-org');
        if (savedOrg) {
          try { currentOrg = JSON.parse(savedOrg); setSelectedOrganization(currentOrg); } catch { /**/ }
        }
        if (!currentOrg?.id) throw new Error('Please select an organization first.');
      }

      const token = localStorage.getItem('token');
      if (!token) throw new Error('No authentication token found. Please log in again.');

      const decoded = JSON.parse(atob(token.split('.')[1]));

      let response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ organization_id: currentOrg.id, donor_id: decoded.id }),
      });

      // Fallback to mock API on network errors
      if (!response.ok) {
        const errorData = await response.clone().json().catch(() => ({}));
        if (errorData.errorCode === 'NETWORK_TIMEOUT' || errorData.errorCode === 'NETWORK_ERROR') {
          response = await fetch('/api/plaid/mock-link-token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ organization_id: currentOrg.id, donor_id: decoded.id }),
          });
        }
      }

      if (!response.ok) {
        const errorData = await response.clone().json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || 'Failed to create link token');
      }

      const { link_token } = await response.json();
      setLinkToken(link_token);

    } catch (err) {
      console.error('Error creating link token:', err);
      setError('Failed to initialize bank connection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready) {
      try { open(); } catch {
        setError('Failed to open bank connection. Please try again.');
      }
    }
  }, [linkToken, ready, open]);

  const handleNext = () => {
    if (currentStep === 1) {
      setError('');
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (!selectedOrganization) { setError('Please select an organization'); return; }
      setError('');
      setCurrentStep(3);
    }
  };

  const handleBack = () => { setError(''); setCurrentStep(currentStep - 1); };

  const handleCardSaved = (pm) => {
    setSavedCard(pm);
    setError('');
    // Card saved — now advance to bank connection step
    setCurrentStep(4);
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

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
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Join Our Round-Up Program</h3>
                <p className="text-sm text-gray-600">Connect your bank and add a funding card</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors duration-200">
              <X size={24} />
            </button>
          </div>

          {!success ? (
            <>
              {/* Step Indicator — 4 steps */}
              <div className="flex items-center justify-center space-x-3 mb-6">
                {[
                  { icon: AlertCircle, label: 'Info' },
                  { icon: Building2,   label: 'Org' },
                  { icon: CreditCard,  label: 'Card' },
                  { icon: Target,      label: 'Bank' },
                ].map(({ icon: Icon }, i) => {
                  const step = i + 1;
                  return (
                    <div key={step} className="flex items-center">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                        currentStep >= step
                          ? 'bg-blue-600 border-blue-600 text-white'
                          : 'bg-gray-100 border-gray-300 text-gray-400'
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      {step < 4 && (
                        <div className={`w-8 h-0.5 mx-1 ${currentStep > step ? 'bg-blue-600' : 'bg-gray-300'}`} />
                      )}
                    </div>
                  );
                })}
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <AnimatePresence mode="wait">
                {/* ── Step 1: Disclaimer ─────────────────────────────────────── */}
                {currentStep === 1 && (
                  <motion.div key="step1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertCircle className="w-8 h-8 text-blue-600" />
                      </div>
                      <h3 className="text-xl font-semibold text-black mb-2">Important Information</h3>
                      <p className="text-black">Please read the following disclaimer before proceeding</p>
                    </div>
                    <div className="max-w-3xl mx-auto">
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                        <div className="flex items-start space-x-4">
                          <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-white text-sm font-bold">i</span>
                          </div>
                          <div className="text-sm text-blue-800 space-y-3">
                            <p>We let you effortlessly support by rounding up your everyday purchases and donating the spare change.</p>
                            <p>To get started, you&apos;ll securely connect your bank account and a funding source (like a debit or credit card). We use read-only access to calculate your round-ups by linking your financial institutions—meaning we can&apos;t move money or see sensitive details, and your banking data is never stored.</p>
                            <p>Your financial information is never visible to anyone; we rely on trusted partners like Stripe and Plaid to keep everything safe and secure.</p>
                            <p>Not into round-ups? You can also set up a simple monthly donation in just a few clicks on your main dashboard.</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm text-black">By clicking &quot;Next&quot;, you acknowledge that you have read and understood this disclaimer.</p>
                    </div>
                  </motion.div>
                )}

                {/* ── Step 2: Select Organization ───────────────────────────── */}
                {currentStep === 2 && (
                  <motion.div key="step2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-black mb-2">Select Organization</h4>
                      <p className="text-black text-sm">Choose which organization will receive your round-up donations.</p>
                    </div>
                    <div className="max-w-2xl mx-auto">
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search organizations..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-black"
                        />
                      </div>
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {loadingOrgs ? (
                          <div className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                            <p className="text-black">Loading organizations...</p>
                          </div>
                        ) : filteredOrganizations.length > 0 ? (
                          filteredOrganizations.map((org) => (
                            <button
                              key={org.id}
                              onClick={() => {
                                setSelectedOrganization(org);
                                localStorage.setItem('selectedOrganization', JSON.stringify(org));
                              }}
                              className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                                selectedOrganization?.id === org.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 overflow-hidden">
                                  {org.imageUrl ? (
                                    <Image src={buildOrgLogoUrl(org.imageUrl)} alt={`${org.name} logo`} width={40} height={40} className="w-full h-full object-contain" />
                                  ) : (
                                    <div className="w-full h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                                      <Heart className="w-5 h-5 text-white" />
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-semibold text-black truncate">{org.name}</h5>
                                  <p className="text-sm text-black truncate">{org.email}</p>
                                </div>
                                {selectedOrganization?.id === org.id && (
                                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-black">No organizations found</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* ── Step 3: Add Funding Card ──────────────────────────────── */}
                {currentStep === 3 && (
                  <motion.div key="step3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CreditCard className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-black mb-2">Add Your Funding Card</h4>
                      <p className="text-black text-sm">
                        This card will be charged when your round-up donations are collected for {selectedOrganization?.name}.
                      </p>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-800">
                          <p className="font-semibold mb-1">Why do I need to add a card?</p>
                          <p>Your card is the <strong>payment method</strong> charged for your round-up donations. After this, you&apos;ll connect your bank account so we can track your spending and calculate round-up amounts.</p>
                        </div>
                      </div>
                    </div>

                    <Elements stripe={stripePromise}>
                      <CardForm
                        onSaved={handleCardSaved}
                        onError={setError}
                        token={token}
                        organizationId={selectedOrganization?.id}
                      />
                    </Elements>

                    <p className="text-xs text-center text-gray-500">
                      Your card is stored securely by Stripe. ChangeWorks never stores card details.
                    </p>
                  </motion.div>
                )}

                {/* ── Step 4: Connect Bank Account ──────────────────────────── */}
                {currentStep === 4 && (
                  <motion.div key="step4" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-6">
                    <div className="text-center">
                      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-black mb-1">Card Saved!</h4>
                      {savedCard && (
                        <p className="text-sm text-green-700 font-medium mb-2">{savedCard.label}</p>
                      )}
                      <p className="text-black text-sm">
                        Now connect your bank account so we can monitor your transactions and calculate round-up amounts.
                      </p>
                    </div>

                    {selectedOrganization && (
                      <div className="bg-gray-50 rounded-lg p-4">
                        <h5 className="font-semibold text-black mb-2">Selected Organization:</h5>
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
                            <Heart className="w-4 h-4 text-white" />
                          </div>
                          <div>
                            <p className="font-medium text-black">{selectedOrganization.name}</p>
                            <p className="text-sm text-black">{selectedOrganization.email}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleConnect}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white py-3 px-6 rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Connecting to Plaid...</span>
                        </div>
                      ) : (
                        'Donate your spare change from every day purchases'
                      )}
                    </button>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-black">
                        <strong>Note:</strong> Your bank account is used only to monitor transactions and calculate round-up amounts. Donations are charged to your {savedCard?.label ?? 'saved card'}.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation — only shown on steps 1–2 (steps 3–4 have their own action buttons) */}
              {currentStep <= 2 && (
                <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                  <button
                    onClick={currentStep === 1 ? onClose : handleBack}
                    className="flex items-center space-x-2 px-4 py-2 text-black hover:text-gray-800 transition-colors duration-200"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
                  </button>

                  <button
                    onClick={handleNext}
                    disabled={currentStep === 2 && !selectedOrganization}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </>
          ) : (
            /* Success screen */
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-black mb-2">You&apos;re all set!</h4>
              <p className="text-black mb-4">Your bank account and funding card have been connected.</p>

              <div className="space-y-3 max-w-xs mx-auto mb-5">
                {savedCard && (
                  <div className="flex items-center space-x-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                    <CreditCard className="w-5 h-5 text-blue-600 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-xs text-blue-700 font-medium">Funding Source (Card)</p>
                      <p className="text-sm font-bold text-blue-900">{savedCard.label}</p>
                    </div>
                  </div>
                )}
                {connectionResult?.institution_name && (
                  <div className="flex items-center space-x-3 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <Building2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <div className="text-left">
                      <p className="text-xs text-green-700 font-medium">Spending Source (Bank)</p>
                      <p className="text-sm font-bold text-green-900">{connectionResult.institution_name}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center space-x-2 text-sm text-black">
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
