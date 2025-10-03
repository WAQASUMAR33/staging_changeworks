'use client';

import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Calendar, 
  DollarSign, 
  Building2, 
  Play,
  Pause,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import StripeSubscriptionModal from '../components/StripeSubscriptionModal';

export default function DonorSubscriptionsPage() {
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [subscriptionToCancel, setSubscriptionToCancel] = useState(null);
  const [cancelImmediately, setCancelImmediately] = useState(false);

  const fetchSubscriptions = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found');
        return;
      }

      // Decode token to get donor ID
      const payload = JSON.parse(atob(token.split('.')[1]));
      const donorId = payload.id;

      const response = await fetch(`/api/subscriptions?donor_id=${donorId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setSubscriptions(data.subscriptions || []);
      } else {
        setError(data.error || 'Failed to load subscriptions');
      }
    } catch (err) {
      console.error('Error fetching subscriptions:', err);
      setError('Failed to load subscriptions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscriptions();
  }, []);

  const handleSubscriptionAction = async (subscriptionId, action) => {
    try {
      setActionLoading(subscriptionId);
      const token = localStorage.getItem('token');
      
      // Decode token to get donor ID
      const payload = JSON.parse(atob(token.split('.')[1]));
      const donorId = payload.id;
      
      let response;
      
      if (action === 'cancel') {
        // Use the correct cancel API
        response = await fetch('/api/subscriptions/cancel-by-donor', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            donor_id: donorId,
            cancel_immediately: false // Cancel at period end by default
          }),
        });
      } else {
        // For other actions (pause, resume), use the individual subscription API
        response = await fetch(`/api/donor/subscriptions/${subscriptionId}/${action}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }

      const data = await response.json();

      if (response.ok) {
        setMessage(`Subscription ${action}ed successfully!`);
        fetchSubscriptions(); // Refresh the list
        setTimeout(() => setMessage(''), 3000);
      } else {
        setError(data.error || `Failed to ${action} subscription`);
      }
    } catch (err) {
      console.error(`Error ${action}ing subscription:`, err);
      setError(`Failed to ${action} subscription`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelClick = (subscription) => {
    setSubscriptionToCancel(subscription);
    setShowCancelDialog(true);
  };

  const handleCancelConfirm = async () => {
    if (subscriptionToCancel) {
      // Use the cancel-by-donor API with the immediate flag
      try {
        setActionLoading(subscriptionToCancel.id);
        const token = localStorage.getItem('token');
        
        // Decode token to get donor ID
        const payload = JSON.parse(atob(token.split('.')[1]));
        const donorId = payload.id;
        
        const response = await fetch('/api/subscriptions/cancel-by-donor', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            donor_id: donorId,
            cancel_immediately: cancelImmediately
          }),
        });

        const data = await response.json();

        if (response.ok) {
          setMessage(data.message || 'Subscription canceled successfully!');
          fetchSubscriptions(); // Refresh the list
          setTimeout(() => setMessage(''), 3000);
        } else {
          setError(data.error || 'Failed to cancel subscription');
        }
      } catch (err) {
        console.error('Error canceling subscription:', err);
        setError('Failed to cancel subscription');
      } finally {
        setActionLoading(null);
      }
      
      setShowCancelDialog(false);
      setSubscriptionToCancel(null);
      setCancelImmediately(false);
    }
  };

  const handleCancelCancel = () => {
    setShowCancelDialog(false);
    setSubscriptionToCancel(null);
    setCancelImmediately(false);
  };

  const handleSubscriptionSuccess = (subscriptionData) => {
    console.log('Subscription created successfully:', subscriptionData);
    // Refresh subscriptions list
    fetchSubscriptions();
    setMessage('Subscription created successfully!');
    setTimeout(() => setMessage(''), 3000);
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'paused':
        return 'text-yellow-600 bg-yellow-100';
      case 'cancelled':
        return 'text-red-600 bg-red-100';
      case 'incomplete':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'paused':
        return <Pause className="w-4 h-4" />;
      case 'cancelled':
        return <Trash2 className="w-4 h-4" />;
      case 'incomplete':
        return <Clock className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

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
          <p className="text-gray-600">Loading subscriptions...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Subscriptions</h1>
          <p className="text-gray-600 mt-2">Manage your recurring donations</p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button 
            onClick={() => setShowSubscriptionModal(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Plus className="w-4 h-4" />
            <span>New Subscription</span>
          </button>
        </div>
      </motion.div>

      {/* Messages */}
      <AnimatePresence>
        {message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3"
          >
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-700 text-sm">{message}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700 text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">
                {subscriptions.filter(sub => sub.status === 'active').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Monthly Total</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatAmount(
                  subscriptions
                    .filter(sub => sub.status === 'active')
                    .reduce((sum, sub) => sum + (sub.amount || 0), 0)
                )}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Subscriptions</p>
              <p className="text-2xl font-bold text-gray-900">{subscriptions.length}</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Organizations</p>
              <p className="text-2xl font-bold text-gray-900">
                {new Set(subscriptions.map(sub => sub.organization?.id)).size}
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-6 h-6 text-orange-600" />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Subscriptions List */}
      <motion.div variants={itemVariants} className="bg-white rounded-xl shadow-sm border border-gray-200">
        {error ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Subscriptions</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <button
              onClick={fetchSubscriptions}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Try Again
            </button>
          </div>
        ) : subscriptions.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Organization</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Amount</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Frequency</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Next Payment</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {subscriptions.map((subscription, index) => (
                  <motion.tr
                    key={subscription.id}
                    variants={itemVariants}
                    className="hover:bg-gray-50 transition-colors duration-200"
                  >
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                          <Building2 className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {subscription.organization?.name || 'Unknown Organization'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {subscription.description || 'Recurring Donation'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-semibold text-gray-900">
                        {formatAmount(subscription.amount || 0)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900 capitalize">
                        {subscription.interval || 'Monthly'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-gray-900">
                        {subscription.nextPaymentDate ? formatDate(subscription.nextPaymentDate) : 'N/A'}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(subscription.status)}`}>
                        {getStatusIcon(subscription.status)}
                        <span className="ml-1">{subscription.status || 'Active'}</span>
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {subscription.status === 'active' ? (
                          <button
                            onClick={() => handleSubscriptionAction(subscription.id, 'pause')}
                            disabled={actionLoading === subscription.id}
                            className="p-2 text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                            title="Pause Subscription"
                          >
                            {actionLoading === subscription.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Pause className="w-4 h-4" />
                            )}
                          </button>
                        ) : subscription.status === 'paused' ? (
                          <button
                            onClick={() => handleSubscriptionAction(subscription.id, 'resume')}
                            disabled={actionLoading === subscription.id}
                            className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg transition-colors duration-200 disabled:opacity-50"
                            title="Resume Subscription"
                          >
                            {actionLoading === subscription.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </button>
                        ) : null}
                        
                        <button
                          onClick={() => handleCancelClick(subscription)}
                          disabled={actionLoading === subscription.id}
                          className="px-3 py-1 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors duration-200 disabled:opacity-50 border border-red-200"
                          title="Cancel Subscription"
                        >
                          {actionLoading === subscription.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Cancel'
                          )}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center">
            <CreditCard className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Subscriptions Found</h3>
            <p className="text-gray-600 mb-4">You don&apos;t have any active subscriptions yet.</p>
            <button 
              onClick={() => setShowSubscriptionModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
            >
              Create Your First Subscription
            </button>
          </div>
        )}
      </motion.div>

      {/* Subscription Modal */}
      <StripeSubscriptionModal
        isOpen={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSuccess={handleSubscriptionSuccess}
      />

      {/* Cancel Confirmation Dialog */}
      <AnimatePresence>
        {showCancelDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={handleCancelCancel}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Cancel Subscription</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 mb-3">
                  Do you really want to cancel the subscription?
                </p>
                {subscriptionToCancel && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-4">
                    <p className="text-sm text-gray-600">
                      <strong>Organization:</strong> {subscriptionToCancel.organization?.name || 'Unknown'}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Amount:</strong> {formatAmount(subscriptionToCancel.amount || 0)} {subscriptionToCancel.interval || 'monthly'}
                    </p>
                  </div>
                )}
                
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="cancel-at-period-end"
                      name="cancelType"
                      checked={!cancelImmediately}
                      onChange={() => setCancelImmediately(false)}
                      className="w-4 h-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <label htmlFor="cancel-at-period-end" className="text-sm text-gray-700">
                      <strong>Cancel at period end</strong> - Continue until current billing period ends
                    </label>
                  </div>
                  <div className="flex items-center space-x-3">
                    <input
                      type="radio"
                      id="cancel-immediately"
                      name="cancelType"
                      checked={cancelImmediately}
                      onChange={() => setCancelImmediately(true)}
                      className="w-4 h-4 text-red-600 border-gray-300 focus:ring-red-500"
                    />
                    <label htmlFor="cancel-immediately" className="text-sm text-gray-700">
                      <strong>Cancel immediately</strong> - Stop subscription right now
                    </label>
                  </div>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={handleCancelCancel}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors duration-200"
                >
                  Keep Subscription
                </button>
                <button
                  onClick={handleCancelConfirm}
                  disabled={actionLoading === subscriptionToCancel?.id}
                  className="flex-1 px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors duration-200 disabled:opacity-50"
                >
                  {actionLoading === subscriptionToCancel?.id ? (
                    <div className="flex items-center justify-center">
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      Canceling...
                    </div>
                  ) : (
                    `Yes, ${cancelImmediately ? 'Cancel Now' : 'Cancel at Period End'}`
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
