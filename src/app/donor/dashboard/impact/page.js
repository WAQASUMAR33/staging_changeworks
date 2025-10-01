'use client';

import { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Heart, 
  Users, 
  Globe,
  Target,
  Award,
  Calendar,
  DollarSign,
  Loader2,
  AlertCircle,
  BarChart3,
  PieChart,
  Building2
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function DonorImpactPage() {
  const [impactData, setImpactData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchImpactData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await fetch('/api/donor/impact', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      
      if (data.success) {
        setImpactData(data.impact);
      } else {
        setError(data.error || 'Failed to load impact data');
      }
    } catch (err) {
      console.error('Error fetching impact data:', err);
      setError('Failed to load impact data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImpactData();
  }, []);

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatNumber = (num) => {
    return new Intl.NumberFormat('en-US').format(num);
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
          <p className="text-gray-600">Loading impact data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading Impact Data</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={fetchImpactData}
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
      {/* Header */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-green-600 to-blue-600 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Your Impact Report</h1>
            <p className="text-green-100">
              See how your donations are making a real difference in the world
            </p>
          </div>
          <div className="hidden md:block">
            <TrendingUp className="w-16 h-16 text-white/20" />
          </div>
        </div>
      </motion.div>

      {/* Key Metrics */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-green-100">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="text-sm font-medium text-green-600">
              +{impactData?.totalDonated?.change || '0%'}
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {formatAmount(impactData?.totalDonated?.value || 0)}
          </h3>
          <p className="text-gray-600 text-sm">Total Donated</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="text-sm font-medium text-blue-600">
              +{impactData?.livesImpacted?.change || '0%'}
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {formatNumber(impactData?.livesImpacted?.value || 0)}
          </h3>
          <p className="text-gray-600 text-sm">Lives Impacted</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-purple-100">
              <Globe className="w-6 h-6 text-purple-600" />
            </div>
            <div className="text-sm font-medium text-purple-600">
              +{impactData?.organizationsSupported?.change || '0%'}
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {formatNumber(impactData?.organizationsSupported?.value || 0)}
          </h3>
          <p className="text-gray-600 text-sm">Organizations Supported</p>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 rounded-lg bg-orange-100">
              <Award className="w-6 h-6 text-orange-600" />
            </div>
            <div className="text-sm font-medium text-orange-600">
              {impactData?.donationStreak || 0}
            </div>
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-1">
            {impactData?.donationStreak || 0}
          </h3>
          <p className="text-gray-600 text-sm">Month Streak</p>
        </div>
      </motion.div>

      {/* Impact Stories */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Impact Stories</h2>
          <div className="space-y-4">
            {impactData?.recentStories?.length > 0 ? (
              impactData.recentStories.map((story, index) => (
                <div key={index} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Heart className="w-5 h-5 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-gray-900 mb-1">{story.title}</h3>
                      <p className="text-xs text-gray-600 mb-2">{story.description}</p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span className="flex items-center space-x-1">
                          <Building2 className="w-3 h-3" />
                          <span>{story.organization}</span>
                        </span>
                        <span className="flex items-center space-x-1">
                          <Calendar className="w-3 h-3" />
                          <span>{story.date}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <Heart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No impact stories available yet</p>
                <p className="text-sm text-gray-400">Your impact stories will appear here</p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Donation Breakdown</h2>
          <div className="space-y-4">
            {impactData?.donationBreakdown?.length > 0 ? (
              impactData.donationBreakdown.map((item, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className="text-sm font-medium text-gray-900">{item.category}</span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">{formatAmount(item.amount)}</p>
                    <p className="text-xs text-gray-500">{item.percentage}%</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <PieChart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No donation data available</p>
                <p className="text-sm text-gray-400">Your donation breakdown will appear here</p>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Monthly Trends */}
      <motion.div variants={itemVariants} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Monthly Donation Trends</h2>
        <div className="h-64 flex items-center justify-center">
          <div className="text-center">
            <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Monthly trends chart will be displayed here</p>
            <p className="text-sm text-gray-400">Interactive chart showing your donation patterns over time</p>
          </div>
        </div>
      </motion.div>

      {/* Achievements */}
      <motion.div variants={itemVariants} className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Achievements</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {impactData?.achievements?.length > 0 ? (
            impactData.achievements.map((achievement, index) => (
              <div key={index} className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Award className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{achievement.title}</h3>
                    <p className="text-xs text-gray-600">{achievement.description}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full text-center py-8">
              <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No achievements yet</p>
              <p className="text-sm text-gray-400">Keep donating to unlock achievements!</p>
            </div>
          )}
        </div>
      </motion.div>

      {/* Call to Action */}
      <motion.div variants={itemVariants} className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white text-center">
        <h2 className="text-2xl font-bold mb-2">Continue Making a Difference</h2>
        <p className="text-blue-100 mb-6">
          Your donations are creating real change. Keep up the amazing work!
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button className="px-6 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-200">
            Make Another Donation
          </button>
          <button className="px-6 py-3 border-2 border-white text-white rounded-lg font-semibold hover:bg-white hover:text-blue-600 transition-colors duration-200">
            Set Up Recurring Donation
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
