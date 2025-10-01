'use client';

import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Heart, 
  TrendingUp, 
  Calendar,
  Gift,
  Target,
  Loader2,
  AlertCircle,
  X,
  CheckCircle,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StripeProvider from './components/StripeProvider';
import StripePaymentForm from './components/StripePaymentForm';

export default function DonorDashboard() {
  const [stats, setStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: '',
    organization_id: '',
    message: ''
  });
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(''); // 'processing', 'success', 'error'
  const [paymentResult, setPaymentResult] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await fetch('/api/donor/dashboard-stats', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        // Transform API data to match component structure
        const transformedStats = [
          {
            title: 'Total Donated',
            value: data.stats.totalDonated.value,
            change: data.stats.totalDonated.change,
            changeType: data.stats.totalDonated.changeType,
            icon: DollarSign,
            color: 'green',
            path: '/donor/dashboard/donations'
          },
          {
            title: 'Active Subscriptions',
            value: data.stats.activeSubscriptions.value,
            change: data.stats.activeSubscriptions.change,
            changeType: data.stats.activeSubscriptions.changeType,
            icon: Heart,
            color: 'red',
            path: '/donor/dashboard/subscriptions'
          },
          {
            title: 'This Month',
            value: data.stats.thisMonth.value,
            change: data.stats.thisMonth.change,
            changeType: data.stats.thisMonth.changeType,
            icon: TrendingUp,
            color: 'blue',
            path: '/donor/dashboard/impact'
          },
          {
            title: 'Organizations Supported',
            value: data.stats.organizationsSupported.value,
            change: data.stats.organizationsSupported.change,
            changeType: data.stats.organizationsSupported.changeType,
            icon: Target,
            color: 'purple',
            path: '/donor/dashboard/impact'
          }
        ];
        
        setStats(transformedStats);
        setRecentActivity(data.recentActivity || []);
      } else {
        setError(data.error || 'Failed to load dashboard data');
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Fetch organizations for payment modal
  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      const response = await fetch('/api/organizations/list');
      const data = await response.json();
      
      if (response.ok) {
        setOrganizations(data);
      } else {
        setError('Failed to load organizations');
      }
    } catch (err) {
      console.error('Error fetching organizations:', err);
      setError('Failed to load organizations');
    } finally {
      setLoadingOrgs(false);
    }
  };

  // Payment form handlers
  const handlePaymentFormChange = (e) => {
    setPaymentForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    setPaymentLoading(true);
    setError('');

    try {
      // Get donor info from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (!user.id) {
        setError('Please log in to make a payment');
        return;
      }

      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: parseFloat(paymentForm.amount),
          currency: 'USD',
          donor_id: user.id,
          organization_id: parseInt(paymentForm.organization_id),
          description: paymentForm.message || `Donation to organization`
        }),
      });

      const data = await response.json();

      if (data.success) {
        setPaymentResult(data);
        setPaymentStatus('processing');
        
        // Simulate Stripe payment processing
        setTimeout(() => {
          setPaymentStatus('success');
          // Refresh dashboard data after successful payment
          fetchDashboardData();
        }, 3000);
      } else {
        setError(data.error || 'Failed to create payment intent');
        setPaymentStatus('error');
      }
    } catch (err) {
      console.error('Payment error:', err);
      setError('Payment failed. Please try again.');
      setPaymentStatus('error');
    } finally {
      setPaymentLoading(false);
    }
  };

  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentStatus('');
    setPaymentResult(null);
    setPaymentForm({
      amount: '',
      organization_id: '',
      message: ''
    });
  };

  // Quick action handlers
  const handleStripePayment = () => {
    // Fetch organizations and open payment popup modal
    fetchOrganizations();
    setShowPaymentModal(true);
  };

  const handleStripeSubscription = () => {
    // Redirect to subscription management page
    window.open('/donor/subscriptions', '_blank');
  };

  const handlePlaidIntegration = () => {
    // Redirect to Plaid integration page
    window.open('/donor/plaid-connect', '_blank');
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Dashboard</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchDashboardData}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <StripeProvider>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Your Impact Dashboard</h2>
            <p className="text-blue-100">
              Track your donations, manage subscriptions, and see the difference you&apos;re making
            </p>
          </div>
          <div className="hidden md:block">
            <Gift className="w-16 h-16 text-white/20" />
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => window.location.href = stat.path}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg bg-${stat.color}-100`}>
                  <Icon className={`w-6 h-6 text-${stat.color}-600`} />
                </div>
                <div className={`text-sm font-medium ${
                  stat.changeType === 'increase' ? 'text-green-600' : 
                  stat.changeType === 'decrease' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {stat.change}
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-gray-600 text-sm">{stat.title}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Donations</h3>
          <div className="space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Heart className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.date}</p>
                  </div>
                  <div className="text-sm font-semibold text-green-600">
                    ${activity.amount}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No recent donations found</p>
                <p className="text-sm text-gray-400">Your donation history will appear here</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              onClick={handleStripePayment}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors duration-200 text-left"
            >
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Stripe Payment</p>
                <p className="text-xs text-gray-500">Make a one-time donation</p>
              </div>
            </button>
            
            <button 
              onClick={handleStripeSubscription}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors duration-200 text-left"
            >
              <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Stripe Subscription</p>
                <p className="text-xs text-gray-500">Set up recurring donations</p>
              </div>
            </button>
            
            <button 
              onClick={handlePlaidIntegration}
              className="w-full flex items-center space-x-3 p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors duration-200 text-left"
            >
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <Target className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-900">Plaid Integration</p>
                <p className="text-xs text-gray-500">Connect your bank account</p>
              </div>
            </button>
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
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Stripe Payment</h3>
                    <p className="text-sm text-gray-600">Make a secure donation</p>
                  </div>
                </div>
                <button
                  onClick={closePaymentModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X size={24} />
                </button>
              </div>

              {!paymentStatus && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Donation Amount *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        name="amount"
                        value={paymentForm.amount}
                        onChange={handlePaymentFormChange}
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
                      value={paymentForm.organization_id}
                      onChange={handlePaymentFormChange}
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

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Message (Optional)
                    </label>
                    <textarea
                      name="message"
                      value={paymentForm.message}
                      onChange={handlePaymentFormChange}
                      placeholder="Add a message with your donation..."
                      rows={3}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 resize-none"
                    />
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <p className="text-red-700 text-sm">{error}</p>
                    </div>
                  )}

                  {paymentForm.amount && paymentForm.organization_id && (
                    <div className="pt-4 border-t border-gray-200">
                      <StripePaymentForm
                        amount={paymentForm.amount}
                        organization={organizations.find(org => org.id == paymentForm.organization_id)}
                        message={paymentForm.message}
                        onSuccess={(paymentIntent) => {
                          setPaymentStatus('success');
                          setPaymentResult(paymentIntent);
                          // Refresh dashboard data after successful payment
                          fetchDashboardData();
                        }}
                        onError={(errorMessage) => {
                          setError(errorMessage);
                        }}
                        onCancel={closePaymentModal}
                      />
                    </div>
                  )}

                  {(!paymentForm.amount || !paymentForm.organization_id) && (
                    <div className="flex space-x-3 pt-2">
                      <button
                        type="button"
                        onClick={closePaymentModal}
                        className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:border-gray-300 transition-all duration-200"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={!paymentForm.amount || !paymentForm.organization_id}
                        className="flex-1 bg-gray-400 text-white py-3 px-4 rounded-xl font-semibold cursor-not-allowed transition-all duration-200"
                      >
                        Fill in details to continue
                      </button>
                    </div>
                  )}
                </div>
              )}

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
      </motion.div>
    </StripeProvider>
  );
}
