'use client';
import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
    DollarSign,
    Building2,
    TrendingUp,
    Activity,
    Users,
    Loader2,
    Calendar,
    Target,
    Zap,
    CheckCircle,
    AlertCircle
} from 'lucide-react';

// Helper function to build organization logo URL
const buildOrgLogoUrl = (imageUrl) => {
    if (!imageUrl) return null;

    // If it's already a full URL, return as-is
    if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        return imageUrl;
    }

    // Use the environment variable for the base URL
    const baseUrl = process.env.NEXT_PUBLIC_IMAGE_BACK_URL;
    if (!baseUrl) {
        console.warn('NEXT_PUBLIC_IMAGE_BACK_URL is not set. Cannot build image URL.');
        return imageUrl; // Fallback to original imageUrl if base URL is not configured
    }

    // Ensure the base URL ends with a slash and the image URL doesn't start with one
    const cleanedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
    const cleanedImageUrl = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;

    return `${cleanedBaseUrl}${cleanedImageUrl}`;
};

const getColorClasses = (color) => {
    const colors = {
        blue: {
            bg: 'bg-blue-50',
            icon: 'text-blue-600',
            border: 'border-blue-200',
            hover: 'hover:bg-blue-100',
            gradient: 'from-blue-500 to-blue-600',
            shadow: 'shadow-blue-500/30'
        },
        green: {
            bg: 'bg-green-50',
            icon: 'text-green-600',
            border: 'border-green-200',
            hover: 'hover:bg-green-100',
            gradient: 'from-green-500 to-green-600',
            shadow: 'shadow-green-500/30'
        },
        purple: {
            bg: 'bg-purple-50',
            icon: 'text-purple-600',
            border: 'border-purple-200',
            hover: 'hover:bg-purple-100',
            gradient: 'from-purple-500 to-purple-600',
            shadow: 'shadow-purple-500/30'
        },
        orange: {
            bg: 'bg-orange-50',
            icon: 'text-orange-600',
            border: 'border-orange-200',
            hover: 'hover:bg-orange-100',
            gradient: 'from-orange-500 to-orange-600',
            shadow: 'shadow-orange-500/30'
        }
    };
    return colors[color] || colors.blue;
};

export default function OrganizationDashboard() {
    const [stats, setStats] = useState([]);
    const [recentActivity, setRecentActivity] = useState([]);
    const [organization, setOrganization] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [onboardingLoading, setOnboardingLoading] = useState(false);

    // Store organization data in sessionStorage for header access
    useEffect(() => {
        if (organization) {
            const orgUser = JSON.parse(sessionStorage.getItem('orgUser') || '{}');
            const updatedOrgUser = { ...orgUser, imageUrl: organization.imageUrl, stripeAccountId: organization.stripeAccountId ?? orgUser.stripeAccountId };
            sessionStorage.setItem('orgUser', JSON.stringify(updatedOrgUser));

            // Dispatch custom event to notify header of update
            window.dispatchEvent(new CustomEvent('orgUserUpdated'));
        }
    }, [organization]);

    const handleGenerateOnboardingLink = async () => {
        if (!organization?.stripeAccountId) return;
        
        try {
            setOnboardingLoading(true);
            const response = await fetch('/api/organization/stripe-onboarding-link', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ stripeAccountId: organization.stripeAccountId }),
            });
            
            const data = await response.json();
            
            if (data.success && data.url) {
                window.location.href = data.url;
            } else {
                alert('Failed to generate onboarding link. Please try again.');
            }
        } catch (error) {
            console.error('Error generating onboarding link:', error);
            alert('An error occurred. Please try again.');
        } finally {
            setOnboardingLoading(false);
        }
    };

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
                setOrganization(data.organization);
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
            className="min-h-screen bg-white"
        >
            <div className="space-y-8 p-6">
                {/* Modern Header Section */}
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1, duration: 0.6 }}
                    className="text-center"
                >
                    <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-4 shadow-lg overflow-hidden">
                        {organization?.imageUrl ? (
                            <Image
                                src={buildOrgLogoUrl(organization.imageUrl)}
                                alt={`${organization.name} logo`}
                                width={80}
                                height={80}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center">
                                <Building2 className="w-8 h-8 text-white" />
                            </div>
                        )}
                    </div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent mb-3">
                        {organization?.name || 'Organization'} Dashboard
                    </h1>
                    <p className="text-gray-600 max-w-2xl mx-auto text-lg mb-4">
                        Welcome to your ChangeWorks organization Dashboard. Manage your donors, and track donations.
                    </p>
                    {/* Stripe Status Section */}
                    <div className="w-full max-w-2xl mx-auto mb-10">
                        {!organization?.stripeAccountId ? (
                            <motion.div 
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="bg-white p-6 rounded-2xl shadow-lg border border-red-100 flex flex-col items-center text-center space-y-3 relative overflow-hidden group"
                            >
                                <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
                                <div className="p-3 bg-red-50 rounded-full text-red-600 group-hover:scale-110 transition-transform duration-300">
                                    <AlertCircle className="w-6 h-6" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-900">Stripe Not Connected</h3>
                                    <p className="text-gray-500 text-sm mt-1">Connect your Stripe account to start accepting donations securely.</p>
                                </div>
                            </motion.div>
                        ) : (
                            <>
                                {/* 1. Account Created but Onboarding Not Done */}
                                {!organization.stripeStatus?.details_submitted ? (
                                    <motion.div 
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        className="bg-white p-6 rounded-2xl shadow-lg border border-yellow-100 flex flex-col items-center text-center space-y-4 relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-1 h-full bg-yellow-500" />
                                        <div className="p-3 bg-yellow-50 rounded-full text-yellow-600">
                                            <AlertCircle className="w-6 h-6" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">Complete Setup Required</h3>
                                            <p className="text-gray-500 text-sm mt-1">Finish your Stripe onboarding to activate payments.</p>
                                        </div>
                                        <button
                                            onClick={handleGenerateOnboardingLink}
                                            disabled={onboardingLoading}
                                            className="px-6 py-2.5 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:from-yellow-600 hover:to-yellow-700 transition-all duration-300 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {onboardingLoading ? 'Generating Link...' : 'Complete Onboarding'}
                                        </button>
                                    </motion.div>
                                ) : (
                                    /* 2. Onboarding Done but Products Not Created */
                                    !(organization.stripeProductId1 || organization.stripeProductId2 || organization.stripeProductId3) ? (
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-white p-6 rounded-2xl shadow-lg border border-blue-100 flex flex-col items-center text-center space-y-4 relative overflow-hidden"
                                        >
                                            <div className="absolute top-0 left-0 w-1 h-full bg-blue-500" />
                                            <div className="p-3 bg-blue-50 rounded-full text-blue-600">
                                                <AlertCircle className="w-6 h-6" />
                                            </div>
                                            <div>
                                                <h3 className="text-lg font-semibold text-gray-900">Setup Donation Options</h3>
                                                <p className="text-gray-500 text-sm mt-1">Your account is ready. Create donation tiers to start fundraising.</p>
                                            </div>
                                            <Link 
                                                href="/organization/dashboard/stripe-products"
                                                className="px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-300 transform hover:-translate-y-0.5"
                                            >
                                                Create Donation Options
                                            </Link>
                                        </motion.div>
                                    ) : (
                                        /* 3. All Complete */
                                        <motion.div 
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="bg-white/60 backdrop-blur-md p-4 rounded-2xl border border-green-100 flex items-center justify-center space-x-3 text-green-700 shadow-sm"
                                        >
                                            <div className="p-1.5 bg-green-100 rounded-full">
                                                <CheckCircle className="w-5 h-5" />
                                            </div>
                                            <span className="font-medium">Stripe payments are fully configured and active</span>
                                        </motion.div>
                                    )
                                )}
                            </>
                        )}
                    </div>
                </motion.div>

                {/* Modern Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
                    {stats.map((stat, index) => {
                        const colors = getColorClasses(stat.color);
                        return (
                            <motion.div
                                key={stat.title}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: index * 0.1 + 0.2, duration: 0.5 }}
                                className="bg-white rounded-3xl p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-gray-100 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-all duration-300 hover:-translate-y-1 group relative overflow-hidden"
                            >
                                <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${colors.gradient} opacity-[0.03] rounded-bl-full -mr-10 -mt-10 transition-opacity group-hover:opacity-[0.08]`} />
                                
                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <div className={`p-4 rounded-2xl bg-gradient-to-br ${colors.gradient} shadow-lg ${colors.shadow} group-hover:scale-110 transition-transform duration-300`}>
                                        <stat.icon className="w-7 h-7 text-white" />
                                    </div>
                                </div>
                                
                                <div className="relative z-10">
                                    <h3 className="text-4xl font-bold text-gray-900 mb-2 tracking-tight">{stat.value}</h3>
                                    <p className="text-gray-500 font-medium text-lg">{stat.title}</p>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
}
