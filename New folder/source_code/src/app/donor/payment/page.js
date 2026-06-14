'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DollarSign, CreditCard, ArrowLeft, Loader2, X, CheckCircle, AlertCircle, ShieldCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import StripeProvider from '../dashboard/components/StripeProvider';

function CheckoutForm({ organizations, loadingOrgs }) {
  const stripe = useStripe();
  const elements = useElements();
  const router = useRouter();

  const [formData, setFormData] = useState({
    amount: '',
    organization_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(''); // 'processing', 'success', 'error'
  const [paymentResult, setPaymentResult] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError('');

    try {
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) {
        setError('Please log in to make a payment');
        return;
      }

      // 1. Create Payment Intent (90/10 split is handled here)
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Math.round(parseFloat(formData.amount) * 100),
          currency: 'USD',
          donor_id: parseInt(user.id),
          organization_id: parseInt(formData.organization_id),
          description: `Donation to organization`
        }),
      });

      const data = await response.json();
      if (!data.success) {
        const errorMsg = data.details || data.error || 'Failed to initialize payment';
        throw new Error(errorMsg);
      }

      const clientSecret = data.client_secret;
      setShowPaymentModal(true);
      setPaymentStatus('processing');

      // Find the selected organization's stripeAccountId
      const selectedOrg = organizations.find(o => o.id === parseInt(formData.organization_id));
      if (!selectedOrg?.stripeAccountId) {
        throw new Error('Organization Stripe account not found');
      }

      // 2. Confirm Payment with Stripe
      const result = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement),
          billing_details: {
            name: user.name || 'Donor',
            email: user.email || '',
          },
        },
      });

      if (result.error) {
        setPaymentStatus('error');
        setError(result.error.message);
      } else if (result.paymentIntent.status === 'succeeded') {
        // 3. Confirm and record in our database
        const confirmResponse = await fetch('/api/payments/confirm-and-record', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payment_intent_id: result.paymentIntent.id,
            donor_id: parseInt(user.id),
            organization_id: parseInt(formData.organization_id)
          }),
        });

        const confirmData = await confirmResponse.json();
        if (confirmData.success) {
          setPaymentResult({
            amount: formData.amount,
            transaction_id: confirmData.transaction?.trx_id || result.paymentIntent.id
          });
          setPaymentStatus('success');
        } else {
          throw new Error('Payment succeeded but failed to save record');
        }
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setPaymentStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    if (paymentStatus === 'success') {
      router.push('/donor/dashboard');
    }
    setPaymentStatus('');
  };

  return (
    <>
      {/* Payment Form */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="max-w-2xl mx-auto"
      >
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-50 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Secure Donation</h2>
            </div>
            <div className="flex items-center space-x-1 text-green-600 bg-green-50 px-3 py-1 rounded-full text-xs font-bold">
              <ShieldCheck className="w-3 h-3" />
              <span>SSL SECURED</span>
            </div>
          </div>

          {error && paymentStatus !== 'error' && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 text-sm leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Donation Amount
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</span>
                  <input
                    type="number"
                    name="amount"
                    value={formData.amount}
                    onChange={handleChange}
                    placeholder="0.00"
                    min="1"
                    step="0.01"
                    required
                    className="w-full pl-9 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-black focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Recipient Organization
                </label>
                <select
                  name="organization_id"
                  value={formData.organization_id}
                  onChange={handleChange}
                  required
                  disabled={loadingOrgs}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-black focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all outline-none disabled:opacity-50 font-medium appearance-none"
                >
                  <option value="">
                    {loadingOrgs ? 'Loading list...' : 'Select Organization'}
                  </option>
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="pt-4">
              <label className="block text-sm font-bold text-gray-700 mb-3">
                Credit or Debit Card
              </label>
              <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl focus-within:ring-2 focus-within:ring-blue-500 focus-within:bg-white transition-all">
                <CardElement
                  options={{
                    style: {
                      base: {
                        fontSize: '16px',
                        color: '#000000',
                        '::placeholder': { color: '#aab7c4' },
                        fontFamily: 'Inter, sans-serif',
                      },
                      invalid: { color: '#dc2626' },
                    },
                  }}
                />
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Your payment info is processed securely by Stripe. We do not store your card details.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !stripe || !formData.amount || !formData.organization_id}
              className="w-full bg-blue-600 text-white py-4 px-6 rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-200 flex items-center justify-center space-x-2 text-lg"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <CreditCard className="w-5 h-5" />
                  <span>Confirm Donation</span>
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Payment Success/Error Modal */}
      <AnimatePresence>
        {showPaymentModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl p-8 w-full max-w-md text-center"
            >
              {paymentStatus === 'processing' && (
                <div className="py-4">
                  <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">Finalizing Payment</h4>
                  <p className="text-gray-500">Contacting Stripe to verify your transaction...</p>
                </div>
              )}

              {paymentStatus === 'success' && (
                <div className="py-4">
                  <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="w-10 h-10 text-green-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">Thank You!</h4>
                  <p className="text-gray-500 mb-6">Your donation was successful and the 90/10 split has been applied.</p>

                  {paymentResult && (
                    <div className="bg-gray-50 rounded-2xl p-4 mb-8 text-sm">
                      <div className="flex justify-between mb-2">
                        <span className="text-gray-400">Amount</span>
                        <span className="font-bold text-gray-900">${paymentResult.amount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Ref ID</span>
                        <span className="font-mono text-gray-600">{paymentResult.transaction_id.substring(0, 15)}...</span>
                      </div>
                    </div>
                  )}

                  <button
                    onClick={closePaymentModal}
                    className="w-full bg-gray-900 text-white py-3 rounded-xl font-bold hover:bg-black transition-all"
                  >
                    Done
                  </button>
                </div>
              )}

              {paymentStatus === 'error' && (
                <div className="py-4">
                  <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertCircle className="w-10 h-10 text-red-600" />
                  </div>
                  <h4 className="text-2xl font-bold text-gray-900 mb-2">Payment Interrupted</h4>
                  <p className="text-red-500 mb-8">{error}</p>

                  <button
                    onClick={() => { setShowPaymentModal(false); setPaymentStatus(''); }}
                    className="w-full bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-all"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function DonorPaymentPage() {
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [error, setError] = useState('');

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
      } else {
        setOrganizations([]);
        if (data.error && data.error.includes('PrismaClientKnownRequestError')) {
          setError('âš ï¸ Database Connectivity Error: Could not reach the organization server. Please check the DB connection (P1001).');
        } else {
          setError(data.error || 'Failed to load organizations');
        }
      }
    } catch (err) {
      setOrganizations([]);
      setError('Connection Error: The database server might be offline or port 3306 is blocked.');
    } finally {
      setLoadingOrgs(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <motion.div
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 bg-white shadow-sm border border-gray-100 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-7 h-7 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-gray-900">Make a Donation</h1>
                <p className="text-gray-500 font-medium">Support your favorite organization today</p>
              </div>
            </div>
            <button
              onClick={() => window.history.back()}
              className="flex items-center space-x-2 text-gray-500 hover:text-gray-800 bg-white px-4 py-2 rounded-xl border border-gray-200 transition-all font-bold text-sm"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Go Back</span>
            </button>
          </div>
        </motion.div>

        <StripeProvider>
          <CheckoutForm
            organizations={organizations}
            loadingOrgs={loadingOrgs}
          />
        </StripeProvider>

        <div className="mt-12 max-w-2xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <h4 className="font-bold text-gray-900 mb-1">Direct to Cause</h4>
            <p className="text-xs text-gray-500">90% of your donation goes directly to the selected organization&apos;s account.</p>
          </div>
          <div className="p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
            <h4 className="font-bold text-gray-900 mb-1">Impact Tracker</h4>
            <p className="text-xs text-gray-500">Track your contributions and see your collective impact in your dashboard.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
