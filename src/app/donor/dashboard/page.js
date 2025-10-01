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
  AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function DonorDashboard() {
  const [stats, setStats] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  // Quick action handlers
  const handleStripePayment = () => {
    // Redirect to Stripe payment page or open payment modal
    window.open('/donor/payment', '_blank');
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
    </motion.div>
  );
}
