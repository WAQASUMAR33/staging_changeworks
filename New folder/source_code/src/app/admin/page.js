'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Building2, CreditCard, Activity, DollarSign } from 'lucide-react';

export default function AdminDashboard() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        
        // Get authentication token
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        console.log('🔍 Admin Dashboard - Token check:', {
          adminToken: localStorage.getItem('adminToken'),
          regularToken: localStorage.getItem('token'),
          adminUser: localStorage.getItem('adminUser'),
          user: localStorage.getItem('user'),
          selectedToken: token
        });
        
        if (!token) {
          throw new Error('Authentication required');
        }
        
        const res = await fetch('/api/admin/dashboard-stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        const data = await res.json();
        console.log('🔍 Admin Dashboard - API Response:', {
          status: res.status,
          success: data.success,
          error: data.error,
          data: data
        });
        
        if (!data.success) throw new Error(data.error || 'Failed to load');

        const cards = [
          {
            title: 'Total Donors',
            value: data.stats.totalDonors.value,
            change: undefined,
            changeType: 'neutral',
            icon: Users,
            color: 'blue'
          },
          {
            title: 'Total Organizations',
            value: data.stats.totalOrganizations.value,
            change: undefined,
            changeType: 'neutral',
            icon: Building2,
            color: 'green'
          },
          {
            title: 'Total Donations',
            value: data.stats.totalDonations.value,
            change: undefined,
            changeType: 'neutral',
            icon: DollarSign,
            color: 'purple'
          },
          {
            title: 'Active Transactions',
            value: String(data.stats.activeTransactions.value),
            change: undefined,
            changeType: 'neutral',
            icon: CreditCard,
            color: 'orange'
          }
        ];

        setStats(cards);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-500 text-blue-100',
      green: 'bg-green-500 text-green-100',
      purple: 'bg-purple-500 text-purple-100',
      orange: 'bg-orange-500 text-orange-100'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to the admin control panel</p>
        {error && (
          <p className="text-red-600 mt-2">{error}</p>
        )}
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
      >
        {(loading ? [1,2,3,4] : stats).map((stat, index) => (
          <motion.div
            key={stat.title || index}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 + index * 0.1 }}
            className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow duration-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{loading ? 'Loading' : stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? '—' : stat.value}</p>
                <div className="flex items-center mt-2">
                  {stat?.change !== undefined && (
                    <>
                      <span className={`text-sm font-medium ${
                        stat.changeType === 'positive' ? 'text-green-600' : stat.changeType === 'negative' ? 'text-red-600' : 'text-gray-500'
                      }`}>
                        {stat.change}
                      </span>
                      <span className="text-sm text-gray-500 ml-1">vs last month</span>
                    </>
                  )}
                </div>
              </div>
              {!loading && (
                <div className={`p-3 rounded-lg ${getColorClasses(stat.color)}`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              )}
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
      >
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a href="/admin/users_management" className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-gray-700">Manage Users</span>
          </a>
          <a href="/admin/organization" className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <Building2 className="w-5 h-5 text-green-600" />
            <span className="text-gray-700">Organizations</span>
          </a>
          <a href="/admin/transactions_page" className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200">
            <Activity className="w-5 h-5 text-purple-600" />
            <span className="text-gray-700">View Reports</span>
          </a>
        </div>
      </motion.div>
    </div>
  );
}