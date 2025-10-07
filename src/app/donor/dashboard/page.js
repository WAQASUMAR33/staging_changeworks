'use client';

import { useState, useEffect, useCallback } from 'react';
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
import MultiStepPaymentForm from './components/MultiStepPaymentForm';
import StripeSubscriptionModal from './components/StripeSubscriptionModal';
import PlaidIntegration from './components/PlaidIntegration';

export default function DonorDashboard() {
  const [stats, setStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(''); // 'processing', 'success', 'error'
  const [paymentResult, setPaymentResult] = useState(null);

  // Subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  
  // Plaid integration modal state
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [showPlaidDisconnectModal, setShowPlaidDisconnectModal] = useState(false);
  const [plaidConnectionStatus, setPlaidConnectionStatus] = useState({
    isConnected: false,
    connections: [],
    loading: true
  });

  // Stripe subscription status state
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    hasActiveSubscription: false,
    subscriptions: [],
    loading: true
  });

  const checkPlaidConnection = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      // Decode token to get donor_id
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const donorId = decoded.id;

      const response = await fetch(`/api/plaid/check-connection?donor_id=${donorId}`);

      if (response.ok) {
        const data = await response.json();
        setPlaidConnectionStatus({
          isConnected: data.is_connected,
          connections: data.connections || [],
          loading: false
        });
      } else {
        setPlaidConnectionStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error checking Plaid connection:', error);
      setPlaidConnectionStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const checkSubscriptionStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/subscriptions/check-status', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setSubscriptionStatus({
          hasActiveSubscription: data.has_active_subscription,
          subscriptions: data.subscriptions || [],
          loading: false
        });
      } else {
        setSubscriptionStatus(prev => ({ ...prev, loading: false }));
      }
    } catch (error) {
      console.error('Error checking subscription status:', error);
      setSubscriptionStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const fetchDashboardData = useCallback(async () => {
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
            path: '/donor/dashboard/donations'
          },
          {
            title: 'Organizations Supported',
            value: data.stats.organizationsSupported.value,
            change: data.stats.organizationsSupported.change,
            changeType: data.stats.organizationsSupported.changeType,
            icon: Target,
            color: 'purple',
            path: '/donor/dashboard/donations'
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
  }, []);

  // Payment handlers
  const handlePaymentSuccess = (paymentIntent) => {
    setPaymentStatus('success');
    setPaymentResult(paymentIntent);
    fetchDashboardData(); // Refresh dashboard data
  };

  const handlePaymentError = (error) => {
    setPaymentStatus('error');
    setPaymentResult({ message: error.message });
  };


  const closePaymentModal = () => {
    setShowPaymentModal(false);
    setPaymentStatus('');
    setPaymentResult(null);
  };

  // Quick action handlers
  const handleStripePayment = () => {
    // Open payment popup modal
    setShowPaymentModal(true);
  };

  const handleStripeSubscription = () => {
    // Open subscription modal
    setShowSubscriptionModal(true);
  };

  const handleSubscriptionSuccess = (subscriptionData) => {
    console.log('Subscription created successfully:', subscriptionData);
    // Refresh dashboard data to show updated stats
    fetchDashboardData();
    // Refresh subscription status
    checkSubscriptionStatus();
  };

  const handlePlaidIntegration = () => {
    // Open Plaid integration modal
    setShowPlaidModal(true);
  };

  const handlePlaidSuccess = (result) => {
    console.log('Plaid integration successful:', result);
    // Refresh dashboard data to show updated stats
    fetchDashboardData();
    // Refresh Plaid connection status
    checkPlaidConnection();
  };

  const handlePlaidDisconnect = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('No authentication token found. Please log in again.');
        return;
      }

      const decoded = JSON.parse(atob(token.split('.')[1]));
      const donorId = decoded.id;

      const response = await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ donor_id: donorId })
      });

      const data = await response.json();

      if (response.ok) {
        alert('Plaid connection disconnected successfully!');
        // Refresh Plaid connection status
        checkPlaidConnection();
        // Close the disconnect modal
        setShowPlaidDisconnectModal(false);
      } else {
        alert(`Failed to disconnect Plaid: ${data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error disconnecting Plaid:', error);
      alert('Failed to disconnect Plaid connection. Please try again.');
    }
  };

  useEffect(() => {
    fetchDashboardData();
    checkPlaidConnection();
    checkSubscriptionStatus();
  }, [fetchDashboardData, checkPlaidConnection, checkSubscriptionStatus]);

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
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-4 sm:p-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Your Impact Dashboard</h2>
            <p className="text-blue-100 text-sm sm:text-base">
              Track your donations, manage subscriptions, and see the difference you&apos;re making
            </p>
          </div>
          <div className="hidden sm:block ml-4">
            <Gift className="w-12 h-12 sm:w-16 sm:h-16 text-white/20" />
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.title}
              variants={itemVariants}
              whileHover={{ scale: 1.02 }}
              className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer"
              onClick={() => window.location.href = stat.path}
            >
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className={`p-2 sm:p-3 rounded-lg bg-${stat.color}-100`}>
                  <Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${stat.color}-600`} />
                </div>
                <div className={`text-xs sm:text-sm font-medium ${
                  stat.changeType === 'increase' ? 'text-green-600' : 
                  stat.changeType === 'decrease' ? 'text-red-600' : 'text-gray-600'
                }`}>
                  {stat.change}
                </div>
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-gray-600 text-xs sm:text-sm">{stat.title}</p>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Recent Activity */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Recent Donations</h3>
          <div className="space-y-3 sm:space-y-4">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-2 sm:p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-medium text-gray-900 truncate">{activity.description}</p>
                    <p className="text-xs text-gray-500">{activity.date}</p>
                  </div>
                  <div className="text-xs sm:text-sm font-semibold text-green-600 flex-shrink-0">
                    ${activity.amount}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-6 sm:py-8">
                <Heart className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 text-sm sm:text-base">No recent donations found</p>
                <p className="text-xs sm:text-sm text-gray-400">Your donation history will appear here</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-2 sm:space-y-3">
            <button 
              onClick={handleStripePayment}
              className="w-full flex items-center space-x-3 p-2 sm:p-3 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors duration-200 text-left"
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-medium text-gray-900">Stripe Payment</p>
                <p className="text-xs text-gray-500">Make a one-time donation</p>
              </div>
            </button>
            
            {subscriptionStatus.loading ? (
              <div className="w-full flex items-center space-x-3 p-2 sm:p-3 rounded-lg bg-gray-50">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-300 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 animate-spin" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900">Checking Status...</p>
                  <p className="text-xs text-gray-500">Loading subscription status</p>
                </div>
              </div>
            ) : subscriptionStatus.hasActiveSubscription ? (
              <div className="w-full flex items-center space-x-3 p-2 sm:p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-green-900">Active Subscription</p>
                  <p className="text-xs text-green-600">
                    {subscriptionStatus.subscriptions.length > 0 
                      ? `${subscriptionStatus.subscriptions.length} active subscription${subscriptionStatus.subscriptions.length > 1 ? 's' : ''}`
                      : 'Recurring donations active'
                    }
                  </p>
                </div>
                <button
                  onClick={() => window.location.href = '/donor/dashboard/subscriptions'}
                  className="px-2 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors duration-200"
                >
                  Manage
                </button>
              </div>
            ) : (
              <button 
                onClick={handleStripeSubscription}
                className="w-full flex items-center space-x-3 p-2 sm:p-3 rounded-lg bg-green-50 hover:bg-green-100 transition-colors duration-200 text-left"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900">Stripe Subscription</p>
                  <p className="text-xs text-gray-500">Set up recurring donations</p>
                </div>
              </button>
            )}
            
            {plaidConnectionStatus.loading ? (
              <div className="w-full flex items-center space-x-3 p-2 sm:p-3 rounded-lg bg-gray-50">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-gray-300 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 text-gray-600 animate-spin" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900">Checking Status...</p>
                  <p className="text-xs text-gray-500">Loading Plaid connection</p>
                </div>
              </div>
            ) : plaidConnectionStatus.isConnected ? (
              <div className="w-full flex items-center space-x-3 p-2 sm:p-3 rounded-lg bg-green-50 border border-green-200">
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs sm:text-sm font-medium text-green-900">Plaid Connected</p>
                  <p className="text-xs text-green-600">
                    {plaidConnectionStatus.connections.length > 0 
                      ? `Connected to ${plaidConnectionStatus.connections[0].institution_name || 'Bank'}`
                      : 'Bank account connected'
                    }
                  </p>
                </div>
                <button
                  onClick={() => setShowPlaidDisconnectModal(true)}
                  className="px-2 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors duration-200"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button 
                onClick={handlePlaidIntegration}
                className="w-full flex items-center space-x-3 p-2 sm:p-3 rounded-lg bg-purple-50 hover:bg-purple-100 transition-colors duration-200 text-left"
              >
                <div className="w-7 h-7 sm:w-8 sm:h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Target className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs sm:text-sm font-medium text-gray-900">Plaid Integration</p>
                  <p className="text-xs text-gray-500">Connect your bank account</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* Multi-Step Payment Modal */}
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
              className="bg-white rounded-2xl shadow-2xl p-4 sm:p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto mx-4 sm:mx-0"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Make a Donation</h3>
                    <p className="text-sm text-gray-600">Secure payment with Stripe</p>
                  </div>
                </div>
                <button
                  onClick={closePaymentModal}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X size={24} />
                </button>
              </div>

              {paymentStatus === 'success' && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  </div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h4>
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
                  <h4 className="text-xl font-bold text-gray-900 mb-2">Payment Failed</h4>
                  <p className="text-gray-600 mb-4">
                    {paymentResult?.message || 'There was an error processing your payment. Please try again.'}
                  </p>
                  <button
                    onClick={closePaymentModal}
                    className="w-full bg-gradient-to-r from-red-600 to-orange-600 text-white py-3 px-4 rounded-xl font-semibold hover:from-red-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200"
                  >
                    Close
                  </button>
                </div>
              )}

              {!paymentStatus && (
                <MultiStepPaymentForm
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onCancel={closePaymentModal}
                />
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Subscription Modal */}
      <StripeSubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={handleSubscriptionSuccess}
      />

      {/* Plaid Integration Modal */}
      <PlaidIntegration
        isOpen={showPlaidModal}
        onClose={() => setShowPlaidModal(false)}
        onSuccess={handlePlaidSuccess}
      />

      {/* Plaid Disconnect Confirmation Modal */}
      <AnimatePresence>
        {showPlaidDisconnectModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowPlaidDisconnectModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-red-600 rounded-xl flex items-center justify-center">
                    <AlertCircle className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-800">Disconnect Plaid</h3>
                    <p className="text-sm text-gray-600">Remove bank account connection</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPlaidDisconnectModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-4">
                  Are you sure you want to disconnect your Plaid bank account connection? 
                  This action will remove your bank account link and you&apos;ll need to reconnect 
                  if you want to use Plaid features again.
                </p>
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    <strong>Note:</strong> This will not affect any existing donations or subscriptions.
                  </p>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPlaidDisconnectModal(false)}
                  className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:border-gray-300 transition-all duration-200"
                >
                  Keep Connected
                </button>
                <button
                  onClick={handlePlaidDisconnect}
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 rounded-xl font-semibold hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200"
                >
                  Disconnect
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.div>
    </StripeProvider>
  );
}
