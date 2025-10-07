'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Building2, 
  TrendingUp, 
  Activity,
  Users,
  Loader2,
  Calendar,
  Target,
  Zap
} from 'lucide-react';


const getColorClasses = (color) => {
    const colors = {
        blue: {
            bg: 'bg-blue-50',
            icon: 'text-blue-600',
            border: 'border-blue-200',
            hover: 'hover:bg-blue-100',
            gradient: 'from-blue-500 to-blue-600'
        },
        green: {
            bg: 'bg-green-50',
            icon: 'text-green-600',
            border: 'border-green-200',
            hover: 'hover:bg-green-100',
            gradient: 'from-green-500 to-green-600'
        },
        purple: {
            bg: 'bg-purple-50',
            icon: 'text-purple-600',
            border: 'border-purple-200',
            hover: 'hover:bg-purple-100',
            gradient: 'from-purple-500 to-purple-600'
        },
        orange: {
            bg: 'bg-orange-50',
            icon: 'text-orange-600',
            border: 'border-orange-200',
            hover: 'hover:bg-orange-100',
            gradient: 'from-orange-500 to-orange-600'
        }
    };
    return colors[color] || colors.blue;
};

export default function OrganizationDashboard() {
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
            
            // Get organization ID from sessionStorage
            const orgUser = sessionStorage.getItem('orgUser');
            if (!orgUser) {
                setError('Organization not found');
                return;
            }
            
            const userData = JSON.parse(orgUser);
            const organizationId = userData.id;
            
            const response = await fetch(`/api/organization/dashboard-stats?organizationId=${organizationId}`);
            const data = await response.json();
            
            if (data.success) {
                // Transform API data to match component structure
                const transformedStats = [
                    {
                        title: 'Total Donations',
                        value: data.stats.totalDonations.value,
                        change: data.stats.totalDonations.change,
                        changeType: data.stats.totalDonations.changeType,
                        icon: DollarSign,
                        color: 'green'
                    },
                    {
                        title: 'This Month',
                        value: data.stats.thisMonth.value,
                        change: data.stats.thisMonth.change,
                        changeType: data.stats.thisMonth.changeType,
                        icon: TrendingUp,
                        color: 'orange'
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
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100"
        >
            <div className="space-y-8 p-6">
                {/* Modern Header Section */}
                <motion.div 
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.6 }}
                    className="text-center"
                >
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0E0061] rounded-2xl mb-4 shadow-lg">
                        <Building2 className="w-8 h-8 text-white" />
                    </div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-3">
                        Organization Dashboard
                    </h1>
                    <p className="text-gray-600 max-w-2xl mx-auto text-lg">
                        Welcome to your ChangeWorks organization Dashboard. Manage your donors, and track donations.
                    </p>
                </motion.div>

                {/* Modern Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
                    {stats.map((stat, index) => {
                        const colors = getColorClasses(stat.color);
                        return (
                            <motion.div
                                key={stat.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1, duration: 0.5 }}
                                className="bg-white/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-white/20 hover:shadow-2xl transition-all duration-300 group"
                            >
                                <div className="flex items-center justify-between mb-4">
                                    <div className={`p-4 rounded-2xl bg-gradient-to-r ${colors.gradient} shadow-lg`}>
                                        <stat.icon className="w-6 h-6 text-white" />
                                    </div>
                                    <div className={`flex items-center space-x-1 text-sm font-medium px-2 py-1 rounded-full ${
                                        stat.changeType === 'increase' 
                                            ? 'bg-green-100 text-green-700' 
                                            : 'bg-red-100 text-red-700'
                                    }`}>
                                        <TrendingUp className="w-3 h-3" />
                                        <span>{stat.change}</span>
                                    </div>
                                </div>
                                <h3 className="text-3xl font-bold text-gray-900 mb-2">{stat.value}</h3>
                                <p className="text-gray-600 font-medium">{stat.title}</p>
                            </motion.div>
                        );
                    })}
                </div>


                {/* Modern Recent Activity */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="max-w-6xl mx-auto"
                >
                    <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">Recent Activity</h2>
                    <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8">
                        {recentActivity.length > 0 ? (
                            <div className="space-y-4">
                                {recentActivity.map((activity, index) => {
                                    const getActivityIcon = (type) => {
                                        switch (type) {
                                            case 'donation': return DollarSign;
                                            case 'ghl': return Building2;
                                            default: return Users;
                                        }
                                    };
                                    
                                    const getActivityColor = (color) => {
                                        switch (color) {
                                            case 'green': return { bg: 'bg-green-50', icon: 'bg-green-500' };
                                            case 'blue': return { bg: 'bg-blue-50', icon: 'bg-blue-500' };
                                            default: return { bg: 'bg-purple-50', icon: 'bg-purple-500' };
                                        }
                                    };
                                    
                                    const ActivityIcon = getActivityIcon(activity.type);
                                    const colors = getActivityColor(activity.color);
                                    
                                    return (
                                        <motion.div 
                                            key={activity.id || index} 
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 }}
                                            className={`flex items-center space-x-4 p-4 ${colors.bg} rounded-2xl hover:shadow-md transition-all duration-200`}
                                        >
                                            <div className={`w-12 h-12 ${colors.icon} rounded-2xl flex items-center justify-center shadow-lg`}>
                                                <ActivityIcon className="w-6 h-6 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="font-semibold text-gray-900">{activity.title}</p>
                                                <p className="text-sm text-gray-600">{activity.description}</p>
                                            </div>
                                            <span className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full">{activity.time}</span>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="w-20 h-20 bg-gradient-to-r from-gray-100 to-gray-200 rounded-3xl flex items-center justify-center mx-auto mb-6">
                                    <Activity className="w-10 h-10 text-gray-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">No recent activity</h3>
                                <p className="text-gray-500">Activity will appear here as you use the platform</p>
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}
