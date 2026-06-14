'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Eye, EyeOff, Lock, AlertCircle, CheckCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ForceResetPasswordPage() {
  const router = useRouter();
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    // If no temp token present, send them back to login
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/donor/login');
    }
  }, [router]);

  const validate = () => {
    const errors = {};
    if (!form.newPassword) {
      errors.newPassword = 'New password is required.';
    } else if (form.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters.';
    }
    if (!form.confirmPassword) {
      errors.confirmPassword = 'Please confirm your new password.';
    } else if (form.newPassword !== form.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match.';
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    if (fieldErrors[name]) setFieldErrors(prev => ({ ...prev, [name]: '' }));
    if (error) setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/donor/force-reset-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ newPassword: form.newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to reset password. Please try again.');
        return;
      }

      // Replace the short-lived token with the new full token
      localStorage.setItem('token', data.token);

      router.replace('/donor/dashboard');
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Background decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000" />
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000" />
      </div>

      {/* Left branding panel */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 text-center z-10"
      >
        <div className="max-w-md">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mb-8"
          >
            <Image
              src="/imgs/changeworks.png"
              alt="ChangeWorks Logo"
              width={200}
              height={200}
              className="mx-auto"
              priority
            />
          </motion.div>
          <h1 className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4">
            Set Your Password
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Your account was created for you. Please choose a personal password before continuing to your dashboard.
          </p>
        </div>
      </motion.div>

      {/* Right form panel */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="relative w-full lg:w-1/2 flex justify-center items-center p-8 lg:p-12 z-10"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="w-full max-w-md"
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 lg:p-10 light-form">
            <h2 className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent">
              Create New Password
            </h2>
            <p className="text-center text-gray-600 mb-8">
              Choose a strong password to secure your donor account.
            </p>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3"
                >
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* New password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    name="newPassword"
                    type={showNew ? 'text' : 'password'}
                    placeholder="Enter new password"
                    value={form.newPassword}
                    onChange={handleChange}
                    disabled={loading}
                    className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-black ${
                      fieldErrors.newPassword
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showNew ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <AnimatePresence>
                  {fieldErrors.newPassword && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>{fieldErrors.newPassword}</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              {/* Confirm password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    name="confirmPassword"
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={form.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                    className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 text-black ${
                      fieldErrors.confirmPassword
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    disabled={loading}
                  >
                    {showConfirm ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
                <AnimatePresence>
                  {fieldErrors.confirmPassword && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                    >
                      <AlertCircle className="w-3 h-3" />
                      <span>{fieldErrors.confirmPassword}</span>
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-2">
                <CheckCircle className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-blue-700 text-sm">
                  Password must be at least 6 characters long.
                </p>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full bg-[#0E0061] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#0C0055] focus:outline-none focus:ring-2 focus:ring-[#0E0061]/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
              >
                {loading ? (
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Saving password...</span>
                  </div>
                ) : (
                  'Save Password & Continue'
                )}
              </motion.button>
            </form>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
