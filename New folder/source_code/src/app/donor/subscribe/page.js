'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Building2,
    CreditCard,
    Check,
    ChevronRight,
    Loader2,
    AlertCircle,
    Gift,
    ShieldCheck,
    Star,
    Zap,
    Coffee
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { buildOrgLogoUrl } from '@/lib/image-utils';
import StripeProvider from '../dashboard/components/StripeProvider';
import DonorSidebar from '../dashboard/components/sidebar';
import DonorHeader from '../dashboard/components/header';

const PackageCard = ({ pkg, onSelect, selected }) => {
    const isPopular = pkg.name.toLowerCase().includes('popular') || pkg.name.toLowerCase().includes('2');

    return (
        <motion.div
            whileHover={{ y: -5, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`relative p-6 rounded-3xl cursor-pointer transition-all duration-300 border-2 ${selected
                ? 'border-blue-500 bg-blue-50/50 shadow-xl shadow-blue-100'
                : 'border-gray-100 bg-white hover:border-blue-200 hover:shadow-lg'
                }`}
            onClick={() => onSelect(pkg)}
        >
            {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full shadow-lg flex items-center space-x-1">
                    <Star className="w-3 h-3 fill-current" />
                    <span>MOST POPULAR</span>
                </div>
            )}

            <div className="flex flex-col h-full">
                <div className="flex items-center justify-between mb-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${selected ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
                        }`}>
                        {pkg.name.includes('1') ? <Coffee className="w-6 h-6" /> :
                            pkg.name.includes('2') ? <Zap className="w-6 h-6" /> :
                                <Star className="w-6 h-6" />}
                    </div>
                    {selected && (
                        <div className="bg-blue-600 text-white p-1 rounded-full">
                            <Check className="w-4 h-4" />
                        </div>
                    )}
                </div>

                <h3 className="text-xl font-black text-gray-900 mb-1">{pkg.name}</h3>
                <p className="text-sm text-gray-500 mb-6 line-clamp-2">{pkg.description}</p>

                <div className="mt-auto">
                    <div className="flex items-baseline space-x-1 mb-6">
                        <span className="text-3xl font-black text-gray-900">
                            ${(pkg.price.unit_amount / 100).toFixed(0)}
                        </span>
                        <span className="text-gray-500 font-bold text-sm">/month</span>
                    </div>

                    <button
                        className={`w-full py-3 rounded-xl font-bold transition-all duration-300 ${selected
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                            : 'bg-gray-50 text-gray-900 hover:bg-gray-100'
                            }`}
                    >
                        {selected ? 'Selected' : 'Select Plan'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

const SubscribePage = () => {
    const router = useRouter();
    const [organizations, setOrganizations] = useState([]);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [packages, setPackages] = useState([]);
    const [selectedPkg, setSelectedPkg] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadingPkgs, setLoadingPkgs] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        fetchOrganizations();
    }, []);

    const fetchOrganizations = async () => {
        try {
            setLoading(true);
            const response = await fetch('/api/organizations/list');
            const data = await response.json();
            if (data.success) {
                setOrganizations(data.organizations);
            } else {
                setError(data.error || 'Failed to load organizations');
            }
        } catch (err) {
            setError('Connection error. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleOrgChange = async (orgId) => {
        const org = organizations.find(o => o.id === parseInt(orgId));
        setSelectedOrg(org);
        setSelectedPkg(null);
        setPackages([]);

        if (org) {
            try {
                setLoadingPkgs(true);
                const response = await fetch(`/api/stripe/organization-products?organization_id=${org.id}&stripe_account_id=${org.stripeAccountId || ''}`);
                const data = await response.json();
                if (data.success) {
                    setPackages(data.products);
                } else {
                    setError(data.error || 'This organization has no packages set up.');
                }
            } catch (err) {
                setError('Failed to load organization packages.');
            } finally {
                setLoadingPkgs(false);
            }
        }
    };

    const handleSubscribe = async () => {
        if (!selectedOrg || !selectedPkg) return;

        try {
            setSubmitting(true);
            setError('');

            const user = JSON.parse(localStorage.getItem('user') || '{}');
            if (!user.id) {
                setError('Please log in to continue.');
                return;
            }

            const response = await fetch('/api/subscriptions/create-connect-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    donor_id: parseInt(user.id),
                    organization_id: selectedOrg.id,
                    product_id: selectedPkg.id,
                    price_id: selectedPkg.price.id
                }),
            });

            const data = await response.json();
            if (data.success && data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error(data.error || 'Failed to initialize subscription.');
            }
        } catch (err) {
            setError(err.message);
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full overflow-hidden bg-slate-50">
            <DonorSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
                <DonorHeader />
                <main className="flex-1 overflow-y-auto p-4 lg:p-8">
                    <div className="max-w-6xl mx-auto space-y-8">
                        {/* Header */}
                        <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                            <div className="space-y-2">
                                <div className="flex items-center space-x-2 text-blue-600 font-black text-xs tracking-widest uppercase">
                                    <Gift className="w-4 h-4" />
                                    <span>Support a Cause</span>
                                </div>
                                <h1 className="text-4xl font-black text-gray-900 tracking-tight">Setup Recurring Donation</h1>
                                <p className="text-gray-500 font-medium max-w-lg">
                                    Join our mission to create lasting change. Select an organization and choose a contribution plan that works for you.
                                </p>
                            </div>
                            <div className="flex items-center space-x-2 px-4 py-2 bg-white rounded-2xl shadow-sm border border-gray-100">
                                <ShieldCheck className="w-4 h-4 text-green-600" />
                                <span className="text-xs font-bold text-gray-600 uppercase tracking-wider">SSL SECURED</span>
                            </div>
                        </header>

                        {/* Error Message */}
                        <AnimatePresence>
                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, y: -20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="p-4 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center space-x-3 text-red-600"
                                >
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <p className="font-bold text-sm">{error}</p>
                                    <button onClick={() => setError('')} className="ml-auto hover:bg-red-100 p-1 rounded-lg">
                                        <Check className="w-4 h-4 rotate-45" />
                                    </button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            {/* Left Column: Selection */}
                            <div className="lg:col-span-1 space-y-6">
                                <section className="bg-white p-8 rounded-3xl shadow-xl shadow-slate-200/50 border border-gray-100">
                                    <h2 className="text-lg font-black text-gray-900 mb-6 flex items-center space-x-2">
                                        <Building2 className="w-5 h-5 text-blue-600" />
                                        <span>1. Select Organization</span>
                                    </h2>
                                    <div className="space-y-4">
                                        <div className="relative">
                                            <select
                                                onChange={(e) => handleOrgChange(e.target.value)}
                                                value={selectedOrg?.id || ''}
                                                className="w-full px-5 py-4 bg-slate-50 border-2 border-slate-100 rounded-2xl text-gray-900 font-bold focus:border-blue-500 focus:bg-white transition-all outline-none appearance-none"
                                            >
                                                <option value="">Search Organization...</option>
                                                {organizations.map(org => (
                                                    <option key={org.id} value={org.id}>{org.name}</option>
                                                ))}
                                            </select>
                                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none">
                                                <ChevronRight className="w-5 h-5 text-gray-400 rotate-90" />
                                            </div>
                                        </div>

                                        {selectedOrg && (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                className="p-4 bg-blue-50 border-2 border-blue-100 rounded-2xl flex items-center space-x-4"
                                            >
                                                <div className="w-12 h-12 bg-white rounded-xl shadow-sm flex items-center justify-center overflow-hidden">
                                                    {selectedOrg.imageUrl ? (
                                                        <Image
                                                            src={buildOrgLogoUrl(selectedOrg.imageUrl)}
                                                            alt={selectedOrg.name}
                                                            width={48}
                                                            height={48}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    ) : <Building2 className="w-6 h-6 text-blue-600" />}
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-gray-900 leading-tight">{selectedOrg.name}</h4>
                                                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mt-1">Certified Partner</p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </div>
                                </section>

                                {selectedPkg && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-gray-900 p-8 rounded-3xl shadow-xl shadow-gray-200 text-white"
                                    >
                                        <h2 className="text-lg font-black mb-6">Subscription Summary</h2>
                                        <div className="space-y-4 text-sm font-medium">
                                            <div className="flex justify-between text-gray-400">
                                                <span>Selected Package</span>
                                                <span className="text-white font-bold">{selectedPkg.name}</span>
                                            </div>
                                            <div className="flex justify-between text-gray-400">
                                                <span>Recipient</span>
                                                <span className="text-white font-bold">{selectedOrg.name}</span>
                                            </div>
                                            <div className="h-px bg-gray-800 my-4" />
                                            <div className="flex justify-between items-end">
                                                <span className="text-gray-400">Monthly Total</span>
                                                <span className="text-2xl font-black">${(selectedPkg.price.unit_amount / 100).toFixed(2)}</span>
                                            </div>
                                        </div>
                                        <button
                                            onClick={handleSubscribe}
                                            disabled={submitting}
                                            className="w-full mt-8 bg-blue-600 hover:bg-blue-500 py-4 rounded-xl font-black flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                                        >
                                            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                                            <span>{submitting ? 'Processing...' : 'Subscribe Now'}</span>
                                        </button>
                                        <p className="text-[10px] text-gray-500 text-center mt-4 uppercase tracking-widest font-black">
                                            Powered by Stripe • Cancel Anytime
                                        </p>
                                    </motion.div>
                                )}
                            </div>

                            {/* Right Column: Packages */}
                            <div className="lg:col-span-2">
                                <section className="h-full min-h-[400px]">
                                    <div className="flex items-center justify-between mb-8">
                                        <h2 className="text-xl font-black text-gray-900 flex items-center space-x-2">
                                            <Star className="w-5 h-5 text-yellow-500 fill-current" />
                                            <span>2. Choose a Plan</span>
                                        </h2>
                                        {loadingPkgs && <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />}
                                    </div>

                                    {!selectedOrg ? (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border-2 border-dashed border-slate-200">
                                            <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                                                <Building2 className="w-10 h-10 text-slate-300" />
                                            </div>
                                            <h3 className="text-xl font-black text-slate-400 mb-2">First, select an organization</h3>
                                            <p className="text-slate-400 text-sm max-w-xs">We&apos;ll show the available contribution plans once you pick a cause to support.</p>
                                        </div>
                                    ) : loadingPkgs ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {[1, 2, 3].map(i => (
                                                <div key={i} className="bg-white p-6 rounded-3xl border-2 border-slate-100 h-[300px] animate-pulse flex flex-col space-y-4">
                                                    <div className="w-12 h-12 bg-slate-100 rounded-xl" />
                                                    <div className="h-6 bg-slate-100 rounded w-2/3" />
                                                    <div className="h-4 bg-slate-100 rounded w-full" />
                                                    <div className="mt-auto h-12 bg-slate-100 rounded-xl" />
                                                </div>
                                            ))}
                                        </div>
                                    ) : packages.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                            {packages.map(pkg => (
                                                <PackageCard
                                                    key={pkg.id}
                                                    pkg={pkg}
                                                    selected={selectedPkg?.id === pkg.id}
                                                    onSelect={setSelectedPkg}
                                                />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-white rounded-3xl border-2 border-dashed border-red-100">
                                            <div className="w-20 h-20 bg-red-50 rounded-full flex items-center justify-center mb-6">
                                                <AlertCircle className="w-10 h-10 text-red-300" />
                                            </div>
                                            <h3 className="text-xl font-black text-red-900 mb-2">No Plans Available</h3>
                                            <p className="text-red-500 text-sm max-w-xs">This organization hasn&apos;t set up any contribution packages yet.</p>
                                        </div>
                                    )}
                                </section>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default function DonorSubscribePage() {
    return (
        <StripeProvider>
            <SubscribePage />
        </StripeProvider>
    );
}
