'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  Building2, 
  Gift, 
  TrendingUp, 
  TrendingDown,
  Activity,
  Target,
  ArrowRight,
  Loader2
} from 'lucide-react';
import Link from 'next/link';

const quickActions = [
    {
        title: 'Recent Activity',
        description: 'View latest transactions',
        icon: Activity,
        color: 'blue',
        path: '/admin/transactions_page'
    },
    {
        title: 'Analytics',
        description: 'View detailed reports',
        icon: Target,
        color: 'green',
        path: '/admin'
    },
    {
        title: 'User Management',
        description: 'Manage users & roles',
        icon: Users,
        color: 'purple',
        path: '/admin/users_management'
    },
];

const getColorClasses = (color) => {
    const colors = {
        blue: {
            bg: 'bg-blue-50',
            icon: 'text-blue-600',
            border: 'border-blue-200',
            hover: 'hover:bg-blue-100'
        },
        green: {
            bg: 'bg-green-50',
            icon: 'text-green-600',
            border: 'border-green-200',
            hover: 'hover:bg-green-100'
        },
        purple: {
            bg: 'bg-purple-50',
            icon: 'text-purple-600',
            border: 'border-purple-200',
            hover: 'hover:bg-purple-100'
        },
        orange: {
            bg: 'bg-orange-50',
            icon: 'text-orange-600',
            border: 'border-orange-200',
            hover: 'hover:bg-orange-100'
        }
    };
    return colors[color] || colors.blue;
};

export default function OverviewCards() {
    const [stats, setStats] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            
            // Get authentication token
            const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
            if (!token) {
                throw new Error('Authentication required');
            }
            
            const response = await fetch('/api/admin/dashboard-stats', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();
            
            if (data.success) {
                // Transform API data to match component structure
                const transformedStats = [
                    {
                        title: 'Total Donors',
                        value: data.stats.totalDonors.value,
                        change: data.stats.totalDonors.change,
                        changeType: data.stats.totalDonors.changeType,
                        icon: Users,
                        color: 'blue',
                        path: '/admin/donor-accounts'
                    },
                    {
                        title: 'Today Donations',
                        value: data.stats.todayDonations.value,
                        change: data.stats.todayDonations.change,
                        changeType: data.stats.todayDonations.changeType,
                        icon: DollarSign,
                        color: 'green',
                        path: '/admin/transactions_page'
                    },
                    {
                        title: 'Organizations',
                        value: data.stats.totalOrganizations.value,
                        change: data.stats.totalOrganizations.change,
                        changeType: data.stats.totalOrganizations.changeType,
                        icon: Building2,
                        color: 'purple',
                        path: '/admin/organization'
                    },
                    {
                        title: 'Fund Transfers',
                        value: data.stats.fundTransfers.value,
                        change: data.stats.fundTransfers.change,
                        changeType: data.stats.fundTransfers.changeType,
                        icon: Gift,
                        color: 'orange',
                        path: '/admin/fund-transfer'
                    }
                ];
                
                setStats(transformedStats);
                setRecentActivity(data.recentActivity || []);
            } else {
                setError('Failed to load dashboard data');
            }
        } catch (err) {
            console.error('Error fetching dashboard data:', err);
            setError('Failed to load dashboard data');
        } finally {
            setLoading(false);
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
                <p className="text-red-600 mb-4">{error}</p>
                <button
                    onClick={fetchDashboardData}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header Section */}
            <div className="text-center">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">
                    Dashboard Overview
                </h1>
                <p className="text-gray-600 max-w-2xl mx-auto">
                    Welcome to your ChangeWorks admin dashboard. Here&apos;s a comprehensive overview of your platform&apos;s performance and key metrics.
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => {
                    const colors = getColorClasses(stat.color);
                    return (
                        <Link key={stat.title} href={stat.path}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1, duration: 0.5 }}
                                whileHover={{ y: -2 }}
                                className={`${colors.bg} ${colors.border} p-6 rounded-lg border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer`}
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-2 rounded-lg bg-white shadow-sm`}>
                                        <stat.icon className={`w-5 h-5 ${colors.icon}`} />
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        {stat.changeType === 'increase' ? (
                                            <TrendingUp className="w-4 h-4 text-green-500" />
                                        ) : (
                                            <TrendingDown className="w-4 h-4 text-red-500" />
                                        )}
                                        <span className={`text-sm font-medium ${
                                            stat.changeType === 'increase' ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                            {stat.change}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <h3 className="text-2xl font-bold text-gray-900 mb-1">
                                        {stat.value}
                                    </h3>
                                    <p className="text-sm text-gray-600 font-medium">
                                        {stat.title}
                                    </p>
                                </div>
                            </motion.div>
                        </Link>
                    );
                })}
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {quickActions.map((action, index) => {
                    const colors = getColorClasses(action.color);
                    return (
                        <Link key={action.title} href={action.path}>
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 + index * 0.1, duration: 0.5 }}
                                whileHover={{ y: -2 }}
                                className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className={`p-3 rounded-lg ${colors.bg}`}>
                                            <action.icon className={`w-6 h-6 ${colors.icon}`} />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{action.title}</h3>
                                            <p className="text-sm text-gray-600">{action.description}</p>
                                        </div>
                                    </div>
                                    <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-gray-600 transition-colors duration-200" />
                                </div>
                            </motion.div>
                        </Link>
                    );
                })}
            </div>

            {/* Recent Activity Section */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Activity</h2>
                </div>
                <div className="p-6">
                    {recentActivity.length > 0 ? (
                        <div className="space-y-4">
                            {recentActivity.map((activity, index) => (
                                <div key={activity.id || index} className="flex items-center space-x-4">
                                    <div className={`w-2 h-2 rounded-full ${
                                        activity.color === 'green' ? 'bg-green-500' : 
                                        activity.color === 'blue' ? 'bg-blue-500' : 'bg-gray-500'
                                    }`}></div>
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                                        <p className="text-sm text-gray-600">{activity.description}</p>
                                    </div>
                                    <span className="text-xs text-gray-500">{activity.time}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-500">No recent activity</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
