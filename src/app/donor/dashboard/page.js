'use client';
// Updated: 2026-01-20T21:04

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
  CreditCard,
  Building2
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
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);

  // Payment modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState(''); // 'processing', 'success', 'error'
  const [paymentResult, setPaymentResult] = useState(null);
  const [emailStatus, setEmailStatus] = useState(null);

  // Subscription modal state
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);

  // Plaid integration modal state
  const [showPlaidModal, setShowPlaidModal] = useState(false);
  const [showPlaidDisconnectModal, setShowPlaidDisconnectModal] = useState(false);
  const [plaidConnectionStatus, setPlaidConnectionStatus] = useState({
    isConnected: false,
    connections: [],
    readyToCharge: false,
    fundingSourceReady: false,
    loading: true
  });

  // Round-up history state
  const [roundupRecords, setRoundupRecords] = useState([]);
  const [roundupLoading, setRoundupLoading] = useState(false);

  // Card funding source state
  const [cardFundingStatus, setCardFundingStatus] = useState({
    hasCard: false,
    card: null,
    loading: true,
  });

  // Stripe subscription status state
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    hasActiveSubscription: false,
    subscriptions: [],
    loading: true
  });

  // Fetch organizations
  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch('/api/organizations/list');
      const data = await response.json();

      if (data.success) {
        setOrganizations(data.organizations || []);

        // If no organization is selected, select the first one
        const savedOrg = localStorage.getItem('selectedOrganization');
        if (!savedOrg && data.organizations && data.organizations.length > 0) {
          const firstOrg = data.organizations[0];
          setSelectedOrganization(firstOrg);
          localStorage.setItem('selectedOrganization', JSON.stringify(firstOrg));
          window.dispatchEvent(new CustomEvent('organizationChanged', { detail: firstOrg }));
        } else if (savedOrg) {
          try {
            const parsedOrg = JSON.parse(savedOrg);
            setSelectedOrganization(parsedOrg);
          } catch (error) {
            console.error('Error parsing saved organization:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    }
  }, []);

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
        const connections = data.connections || [];
        const fundingSourceReady = connections.some(c => c.funding_source?.funding_source_ready === true);
        setPlaidConnectionStatus({
          isConnected: data.is_connected,
          connections,
          readyToCharge: data.ready_to_charge || false,
          fundingSourceReady,
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

  const checkCardFundingStatus = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const response = await fetch(`/api/stripe/get-payment-method?donor_id=${decoded.id}`);
      if (response.ok) {
        const data = await response.json();
        setCardFundingStatus({
          hasCard: data.has_payment_method,
          card: data.payment_method ?? null,
          loading: false,
        });
      } else {
        setCardFundingStatus(prev => ({ ...prev, loading: false }));
      }
    } catch {
      setCardFundingStatus(prev => ({ ...prev, loading: false }));
    }
  }, []);

  const fetchRoundupRecords = useCallback(async () => {
    try {
      setRoundupLoading(true);
      const token = localStorage.getItem('token');
      if (!token) return;
      const response = await fetch('/api/donor/roundup-records', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setRoundupRecords(data.records || []);
      }
    } catch {
      // non-fatal
    } finally {
      setRoundupLoading(false);
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
            title: 'Active Recurrent Donations',
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
  const handlePaymentSuccess = (result) => {
    // Check if result has nested structure (from new PaymentConfirmationStep)
    const paymentIntent = result.paymentIntent || result;
    const emailRes = result.emailStatus || null;

    setPaymentStatus('success');
    setPaymentResult(paymentIntent);
    setEmailStatus(emailRes);
    
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
    setEmailStatus(null);
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
    fetchDashboardData();
    checkPlaidConnection();
    checkCardFundingStatus();
    fetchRoundupRecords();
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
    fetchOrganizations();
    checkPlaidConnection();
    checkSubscriptionStatus();
    checkCardFundingStatus();
    fetchRoundupRecords();
  }, [fetchDashboardData, fetchOrganizations, checkPlaidConnection, checkSubscriptionStatus, checkCardFundingStatus, fetchRoundupRecords]);


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
        <div className="mt-4 sm:mt-0">
          <button
            onClick={fetchDashboardData}
            className="flex items-center space-x-2 px-4 py-2 bg-[#0E0061] text-white rounded-lg hover:bg-[#0C0055] transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
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
        <motion.div variants={itemVariants} className="bg-[#0E0061] rounded-2xl p-4 sm:p-6 text-white">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl sm:text-2xl font-bold mb-2">Your Impact Dashboard</h2>
              <p className="text-blue-100 text-sm sm:text-base">
                Track your donations, manage Donations, and see the difference you&apos;re making
              </p>
            </div>

            <div className="hidden sm:block ml-4">
              <Gift className="w-12 h-12 sm:w-16 sm:h-16 text-white/20" />
            </div>
          </div>
        </motion.div>

        {/* Stats Grid */}
        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
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
                <div className="flex items-center mb-3 sm:mb-4">
                  <div className={`p-2 sm:p-3 rounded-lg bg-${stat.color}-100`}>
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${stat.color}-600`} />
                  </div>
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
                <p className="text-gray-600 text-xs sm:text-sm">{stat.title}</p>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Main Content Grid */}
        <div className="space-y-6">
          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-6">Donation Menu</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Donate Now */}
              <motion.button
                onClick={handleStripePayment}
                whileHover={{ scale: 1.05, y: -2 }}
                whileTap={{ scale: 0.95 }}
                className="group relative overflow-hidden bg-gradient-to-br from-green-800 via-green-900 to-green-950 hover:from-green-900 hover:via-green-950 hover:to-black shadow-lg hover:shadow-xl border-0 rounded-2xl p-6 transition-all duration-300 text-left h-full flex flex-col justify-between cursor-pointer"
              >
                <div className="relative z-10 flex flex-col h-full w-full">
                  <div className="flex flex-col items-start gap-4 flex-1 w-full">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                      <DollarSign className="w-6 h-6 text-white" />
                    </div>
                    <div className="w-full">
                      <h4 className="text-lg font-bold text-white leading-tight">Make a One-Time Donation</h4>
                    </div>
                  </div>
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute top-0 right-0">
                    <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                  </div>
                </div>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
              </motion.button>

              {/* Recurring Donations */}
              {subscriptionStatus.loading ? (
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 border-0 rounded-2xl p-6 shadow-sm flex flex-col items-start gap-4 h-full">
                  <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                  <div className="flex-1 w-full">
                    <h4 className="text-lg font-bold text-gray-700 leading-tight">Checking Status...</h4>
                    <p className="text-sm text-gray-500">Loading donation status</p>
                  </div>
                </div>
              ) : subscriptionStatus.hasActiveSubscription ? (
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-green-600 via-green-700 to-green-800 shadow-lg hover:shadow-xl border-0 rounded-2xl p-6 transition-all duration-300 h-full flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative z-10 flex flex-col h-full w-full">
                    <div className="flex flex-col items-start gap-4 mb-4 flex-1 w-full">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 w-full">
                        <h4 className="text-lg font-bold text-white leading-tight">Start and Manage your Monthly Donations</h4>
                        <p className="text-sm text-green-100 mt-1">
                          {subscriptionStatus.subscriptions.length > 0
                            ? `${subscriptionStatus.subscriptions.length} active donation${subscriptionStatus.subscriptions.length > 1 ? 's' : ''}`
                            : 'Recurring donations active'
                          }
                        </p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute top-0 right-0">
                        <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                      </div>
                    </div>
                    <button
                      onClick={handleStripeSubscription}
                      className="w-full bg-white/20 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-white/30 transition-colors duration-200 text-sm font-semibold mt-auto"
                    >
                      Make new Donation
                    </button>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
                </motion.div>
              ) : (
                <motion.button
                  onClick={handleStripeSubscription}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-green-600 via-green-700 to-green-800 hover:from-green-700 hover:via-green-800 hover:to-green-900 shadow-lg hover:shadow-xl border-0 rounded-2xl p-6 transition-all duration-300 text-left h-full flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative z-10 flex flex-col h-full w-full">
                    <div className="flex flex-col items-start gap-4 flex-1 w-full">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <TrendingUp className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 w-full">
                        <h4 className="text-lg font-bold text-white leading-tight">Set up a recurring monthly donation</h4>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute top-0 right-0">
                        <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
                </motion.button>
              )}

              {/* Start Change Donation Now */}
              {plaidConnectionStatus.loading ? (
                <div className="bg-gradient-to-br from-gray-100 to-gray-200 border-0 rounded-2xl p-6 shadow-sm flex flex-col items-start gap-4 h-full">
                  <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Loader2 className="w-6 h-6 text-white animate-spin" />
                  </div>
                  <div className="flex-1 w-full">
                    <h4 className="text-lg font-bold text-gray-700 leading-tight">Checking Status...</h4>
                    <p className="text-sm text-gray-500">Loading Plaid connection</p>
                  </div>
                </div>
              ) : plaidConnectionStatus.isConnected ? (
                <motion.div
                  whileHover={{ scale: 1.05, y: -2 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-green-400 via-green-500 to-green-600 shadow-lg hover:shadow-xl border-0 rounded-2xl p-6 transition-all duration-300 h-full flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative z-10 flex flex-col h-full w-full">
                    <div className="flex flex-col items-start gap-4 mb-4 flex-1 w-full">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <CheckCircle className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 w-full">
                        <h4 className="text-lg font-bold text-white leading-tight">Your Round-Up Program Is Active</h4>
                        <p className="text-sm text-green-100 mt-1">
                          {plaidConnectionStatus.connections.length > 0
                            ? `Connected to ${plaidConnectionStatus.connections[0].institution_name || 'Bank'}`
                            : 'Bank account connected'
                          }
                        </p>
                        {/* Card funding source status badge */}
                        <div className="mt-2">
                          {cardFundingStatus.loading ? (
                            <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2 py-1 rounded-full">
                              <Loader2 className="w-3 h-3 animate-spin" /> Checking card...
                            </span>
                          ) : cardFundingStatus.hasCard ? (
                            <span className="inline-flex items-center gap-1 bg-white/20 text-white text-xs font-semibold px-2 py-1 rounded-full">
                              <CreditCard className="w-3 h-3" /> {cardFundingStatus.card?.label ?? 'Card Active'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-yellow-400/30 text-yellow-100 text-xs font-semibold px-2 py-1 rounded-full">
                              <AlertCircle className="w-3 h-3" /> No funding card
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute top-0 right-0">
                        <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                      </div>
                    </div>
                    <button
                      onClick={() => setShowPlaidDisconnectModal(true)}
                      className="w-full bg-green-800/80 backdrop-blur-sm text-white px-4 py-2 rounded-lg hover:bg-green-900/80 transition-colors duration-200 text-sm font-semibold mt-auto"
                    >
                      Manage
                    </button>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
                </motion.div>
              ) : (
                <motion.button
                  onClick={handlePlaidIntegration}
                  whileHover={{ scale: 1.05, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className="group relative overflow-hidden bg-gradient-to-br from-green-400 via-green-500 to-green-600 hover:from-green-500 hover:via-green-600 hover:to-green-700 shadow-lg hover:shadow-xl border-0 rounded-2xl p-6 transition-all duration-300 text-left h-full flex flex-col justify-between cursor-pointer"
                >
                  <div className="relative z-10 flex flex-col h-full w-full">
                    <div className="flex flex-col items-start gap-4 flex-1 w-full">
                      <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
                        <Target className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 w-full">
                        <h4 className="text-lg font-bold text-white leading-tight">Join Our Round-Up Program</h4>
                        <p className="text-sm text-green-100 mt-1">Donate your spare change from every day purchases</p>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 absolute top-0 right-0">
                        <div className="w-3 h-3 bg-white/30 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700 pointer-events-none"></div>
                </motion.button>
              )}
            </div>
          </motion.div>

          {/* Round-Up History — only when bank is connected */}
          {plaidConnectionStatus.isConnected && (
            <motion.div variants={itemVariants} className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900">Round-Up History</h3>
                <span className="text-xs text-gray-500">Charged to your card via Plaid</span>
              </div>

              {roundupLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600 mr-2" />
                  <span className="text-gray-500 text-sm">Loading round-ups...</span>
                </div>
              ) : roundupRecords.length > 0 ? (
                <div className="space-y-3">
                  {roundupRecords.slice(0, 10).map((record) => (
                    <div key={record.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors duration-200 border border-gray-100">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Target className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {record.organization?.name ?? 'Organization'}
                          </p>
                          {record.card_label && (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                              <CreditCard className="w-3 h-3" /> {record.card_label}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <p className="text-xs text-gray-500">
                            {new Date(record.trx_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          </p>
                          {record.start_date && record.end_date && (
                            <p className="text-xs text-gray-400">
                              ({record.start_date} → {record.end_date})
                            </p>
                          )}
                          {record.transaction_count != null && (
                            <p className="text-xs text-gray-400">{record.transaction_count} txns</p>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-sm font-semibold text-blue-700">${Number(record.trx_amount).toFixed(2)}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          record.pay_status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : record.pay_status === 'pending'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {record.pay_status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <Building2 className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-gray-500 text-sm">No round-up charges yet</p>
                  <p className="text-xs text-gray-400 mt-1">Round-ups will appear here once processed</p>
                </div>
              )}
            </motion.div>
          )}

          {/* Recent Activity */}
          <motion.div variants={itemVariants} className="bg-white rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200">
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
          </motion.div>
        </div>

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
                      <h3 className="text-xl font-bold text-gray-800">Make a One-Time Donation</h3>
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
                  <div className="text-center py-8 relative">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 mt-8">
                      <CheckCircle className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 mb-2">Payment Successful!</h4>
                    <p className="text-gray-600 mb-4">
                      Your donation has been processed successfully.
                    </p>

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
