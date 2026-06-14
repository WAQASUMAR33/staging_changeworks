'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Database, Trash2, Shield, CheckCircle, XCircle, Settings, DollarSign, Loader2, Zap, TestTube } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TwoFactorSetup from '@/app/components/TwoFactorSetup';

export default function AdminSettingsPage() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetStatus, setResetStatus] = useState(null);
  const [confirmationText, setConfirmationText] = useState('');

  // Round-up threshold state
  const [thresholdValue, setThresholdValue] = useState('');
  const [thresholdLoading, setThresholdLoading] = useState(true);
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdStatus, setThresholdStatus] = useState(null); // { type: 'success'|'error', message }

  // Payment mode state
  const [paymentMode, setPaymentMode] = useState('sandbox'); // 'sandbox' | 'live'
  const [modeLoading, setModeLoading] = useState(true);
  const [modeSaving, setModeSaving] = useState(false);
  const [modeStatus, setModeStatus] = useState(null);

  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const adminToken = localStorage.getItem('adminToken');
        const regularToken = localStorage.getItem('token');
        const adminUser = localStorage.getItem('adminUser');
        
        console.log('🔍 Settings Page - Auth check:', {
          adminToken: !!adminToken,
          regularToken: !!regularToken,
          adminUser: !!adminUser,
          adminUserData: adminUser ? JSON.parse(adminUser) : null
        });
        
        const token = adminToken || regularToken;
        if (!token) {
          console.log('❌ Settings Page - No token found, redirecting to login');
          router.push('/admin/secure-portal');
          return;
        }

        const response = await fetch('/api/admin/dashboard-stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          console.log('🔍 Settings Page - API response:', { success: data.success, error: data.error });
          
          if (data.success) {
            // Get user data from localStorage
            if (adminUser) {
              try {
                const userData = JSON.parse(adminUser);
                console.log('🔍 Settings Page - User role check:', userData.role);
                
                if (userData.role === 'SUPERADMIN') {
                  console.log('✅ Settings Page - SUPERADMIN access granted');
                  setUser(userData);
                } else {
                  console.log('❌ Settings Page - Not SUPERADMIN, redirecting to admin dashboard');
                  router.push('/admin');
                }
              } catch (error) {
                console.error('❌ Settings Page - Error parsing admin user:', error);
                router.push('/admin/secure-portal');
              }
            } else {
              console.log('❌ Settings Page - No admin user data, redirecting to login');
              router.push('/admin/secure-portal');
            }
          } else {
            console.log('❌ Settings Page - API returned error:', data.error);
            router.push('/admin/secure-portal');
          }
        } else {
          console.log('❌ Settings Page - API request failed:', response.status);
          router.push('/admin/secure-portal');
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        router.push('/admin/secure-portal');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  // Load threshold setting from API
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
        if (!token) return;
        const res = await fetch('/api/admin/settings', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (data.success) {
          const th = data.settings.find((s) => s.key === 'roundup_minimum_threshold');
          if (th) setThresholdValue(th.value);
          const pm = data.settings.find((s) => s.key === 'payment_mode');
          if (pm) setPaymentMode(pm.value);
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setThresholdLoading(false);
      }
    };
    fetchSettings().finally(() => setModeLoading(false));
  }, []);

  const handleSavePaymentMode = async (newMode) => {
    setModeSaving(true);
    setModeStatus(null);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'payment_mode', value: newMode }),
      });
      const data = await res.json();
      if (data.success) {
        setPaymentMode(newMode);
        setModeStatus({ type: 'success', message: `Switched to ${newMode === 'live' ? 'Live' : 'Sandbox'} mode` });
      } else {
        setModeStatus({ type: 'error', message: data.error || 'Failed to save' });
      }
    } catch {
      setModeStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setModeSaving(false);
    }
  };

  const handleSaveThreshold = async () => {
    const num = parseFloat(thresholdValue);
    if (isNaN(num) || num < 1) {
      setThresholdStatus({ type: 'error', message: 'Minimum value is $1.00 (Stripe ACH requirement)' });
      return;
    }

    setThresholdSaving(true);
    setThresholdStatus(null);
    try {
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ key: 'roundup_minimum_threshold', value: num.toFixed(2) }),
      });
      const data = await res.json();
      if (data.success) {
        setThresholdStatus({ type: 'success', message: `Threshold updated to $${num.toFixed(2)}` });
        setThresholdValue(num.toFixed(2));
      } else {
        setThresholdStatus({ type: 'error', message: data.error || 'Failed to save' });
      }
    } catch (err) {
      setThresholdStatus({ type: 'error', message: 'Network error. Please try again.' });
    } finally {
      setThresholdSaving(false);
    }
  };

  const handleResetDatabase = async () => {
    if (confirmationText !== 'RESET DATABASE') {
      setResetStatus({
        type: 'error',
        message: 'Please type "RESET DATABASE" to confirm'
      });
      return;
    }

    setResetLoading(true);
    setResetStatus(null);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/admin/reset-database', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (data.success) {
        setResetStatus({
          type: 'success',
          message: 'Database reset successfully! All data has been cleared except user accounts.'
        });
        setShowResetModal(false);
        setConfirmationText('');
      } else {
        setResetStatus({
          type: 'error',
          message: data.error || 'Failed to reset database'
        });
      }
    } catch (error) {
      console.error('Reset database error:', error);
      setResetStatus({
        type: 'error',
        message: 'Network error occurred while resetting database'
      });
    } finally {
      setResetLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-8 px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-2">
            <Shield className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Admin Settings</h1>
          </div>
          <p className="text-gray-600">Manage system settings and perform administrative tasks</p>
        </div>

        {/* User Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Current User</h2>
          <div className="flex items-center space-x-4">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="font-medium text-gray-900">{user.name}</p>
              <p className="text-sm text-gray-500">{user.email}</p>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 mt-1">
                {user.role}
              </span>
            </div>
          </div>
        </div>

        {/* Two-Factor Authentication Section */}
        <div className="mb-8">
          <TwoFactorSetup userType="user" />
        </div>

        {/* Payment Mode Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
              {paymentMode === 'live' ? <Zap className="w-6 h-6 text-indigo-600" /> : <TestTube className="w-6 h-6 text-indigo-600" />}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Payment Mode</h2>
              <p className="text-gray-600 mb-4">
                Switch between <strong>Sandbox</strong> (test, no real charges) and <strong>Live</strong> (real payments) for Stripe and Plaid.
                Changes take effect immediately for all new transactions.
              </p>

              {modeLoading ? (
                <div className="flex items-center space-x-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSavePaymentMode('sandbox')}
                    disabled={modeSaving || paymentMode === 'sandbox'}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border-2 transition-all duration-200 ${
                      paymentMode === 'sandbox'
                        ? 'bg-blue-600 border-blue-600 text-white shadow-md cursor-default'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600'
                    }`}
                  >
                    <TestTube className="w-4 h-4" />
                    Sandbox
                    {paymentMode === 'sandbox' && <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">Active</span>}
                  </button>

                  <button
                    onClick={() => handleSavePaymentMode('live')}
                    disabled={modeSaving || paymentMode === 'live'}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-sm border-2 transition-all duration-200 ${
                      paymentMode === 'live'
                        ? 'bg-green-600 border-green-600 text-white shadow-md cursor-default'
                        : 'bg-white border-gray-300 text-gray-700 hover:border-green-500 hover:text-green-600'
                    }`}
                  >
                    {modeSaving && paymentMode !== 'live' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Live
                    {paymentMode === 'live' && <span className="ml-1 text-xs bg-white/20 px-1.5 py-0.5 rounded">Active</span>}
                  </button>
                </div>
              )}

              <AnimatePresence>
                {modeStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mt-3 flex items-center space-x-2 text-sm font-medium ${
                      modeStatus.type === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {modeStatus.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                    <span>{modeStatus.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {paymentMode === 'live' && (
                <div className="mt-4 bg-amber-50 border border-amber-300 rounded-lg p-3 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    <strong>Live mode is active.</strong> All payments will charge real cards and bank accounts.
                    Ensure your live Stripe and Plaid keys are set in <code className="bg-amber-100 px-1 rounded">.env.local</code> before proceeding.
                  </p>
                </div>
              )}

              {paymentMode === 'sandbox' && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-700">
                    <strong>Sandbox mode.</strong> Use Stripe test cards (e.g. 4242 4242 4242 4242) and Plaid sandbox credentials. No real charges are made.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Round-Up Threshold Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Round-Up Minimum Threshold</h2>
              <p className="text-gray-600 mb-4">
                Set the minimum accumulated round-up amount before an ACH charge is sent to Stripe.
                Stripe rejects ACH charges below <strong>$1.00</strong>. A higher threshold (e.g. $5.00)
                reduces per-transaction fees.
              </p>

              {thresholdLoading ? (
                <div className="flex items-center space-x-2 text-gray-500">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm">Loading current value...</span>
                </div>
              ) : (
                <div className="flex items-center space-x-3 max-w-xs">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">$</span>
                    <input
                      type="number"
                      min="1"
                      step="0.50"
                      value={thresholdValue}
                      onChange={(e) => setThresholdValue(e.target.value)}
                      className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-gray-900"
                      placeholder="1.00"
                    />
                  </div>
                  <button
                    onClick={handleSaveThreshold}
                    disabled={thresholdSaving}
                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {thresholdSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Settings className="w-4 h-4 mr-2" />
                        Save
                      </>
                    )}
                  </button>
                </div>
              )}

              <AnimatePresence>
                {thresholdStatus && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`mt-3 flex items-center space-x-2 text-sm font-medium ${
                      thresholdStatus.type === 'success' ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {thresholdStatus.type === 'success' ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <XCircle className="w-4 h-4" />
                    )}
                    <span>{thresholdStatus.message}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-700">
                  <strong>Examples:</strong> $1.00 = charge whenever above Stripe minimum &nbsp;|&nbsp;
                  $5.00 = accumulate up to $5 before charging &nbsp;|&nbsp;
                  $10.00 = monthly minimum
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Database Reset Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <Database className="w-6 h-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Database Management</h2>
              <p className="text-gray-600 mb-4">
                Reset the entire database while preserving user accounts. This action will permanently delete all data including:
              </p>
              <ul className="list-disc list-inside text-gray-600 mb-6 space-y-1">
                <li>All organizations and their data</li>
                <li>All donors and their profiles</li>
                <li>All transactions and payment records</li>
                <li>All subscriptions and Monthly donations</li>
                <li>All GHL accounts and contacts</li>
                <li>All fund transfers and records</li>
                <li>All other application data</li>
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5 mr-3" />
                  <div>
                    <h3 className="text-sm font-medium text-yellow-800">Warning</h3>
                    <p className="text-sm text-yellow-700 mt-1">
                      This action cannot be undone. Make sure you have backed up any important data before proceeding.
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowResetModal(true)}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors duration-200"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Reset Database
              </button>
            </div>
          </div>
        </div>

        {/* Status Messages */}
        <AnimatePresence>
          {resetStatus && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className={`mt-6 p-4 rounded-lg flex items-center space-x-3 ${
                resetStatus.type === 'success' 
                  ? 'bg-green-50 border border-green-200' 
                  : 'bg-red-50 border border-red-200'
              }`}
            >
              {resetStatus.type === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600" />
              )}
              <p className={`text-sm font-medium ${
                resetStatus.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                {resetStatus.message}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Confirm Database Reset</h3>
              </div>
              
              <p className="text-gray-600 mb-6">
                This will permanently delete all data except user accounts. This action cannot be undone.
              </p>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type <span className="font-mono bg-gray-100 px-2 py-1 rounded">RESET DATABASE</span> to confirm:
                </label>
                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                  placeholder="RESET DATABASE"
                />
              </div>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowResetModal(false);
                    setConfirmationText('');
                    setResetStatus(null);
                  }}
                  className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  disabled={resetLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetDatabase}
                  disabled={resetLoading || confirmationText !== 'RESET DATABASE'}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {resetLoading ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Resetting...
                    </div>
                  ) : (
                    'Reset Database'
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
