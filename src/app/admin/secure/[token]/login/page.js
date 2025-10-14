'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Shield, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function SecureAdminLoginPage() {
  const router = useRouter();
  const params = useParams();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [isValidToken, setIsValidToken] = useState(false);
  const [tokenError, setTokenError] = useState('');

  // Valid security tokens (you can add more or generate dynamically)
  const validTokens = useMemo(() => [
    'admin-secure-2025-abbe1ee7-487120-2ae2f7ba',
    'admin-secure-2025-1a34c3c2-48e421-8c696bd8',
    'admin-secure-2025-22602e53-f17f33-efad94fd',
    'admin-secure-2025-f73bcfea-df28dd-1e53b24d',
    'admin-secure-2025-02da133a-4d2ad5-b95e5697',
    'changeworks-admin-q4w6e9r2t',
    'secure-portal-2025-z1x3c5v7b',
    'admin-access-n8m7k6j5h4',
    'secure-login-2025-p9o8i7u6y'
  ], []);

  // Check if token is valid
  useEffect(() => {
    const token = params.token;
    if (!token) {
      setTokenError('Invalid access token');
      return;
    }

    if (validTokens.includes(token)) {
      setIsValidToken(true);
      setTokenError('');
    } else {
      setTokenError('Unauthorized access token');
    }
  }, [params.token, validTokens]);

  // Check if already logged in as admin
  useEffect(() => {
    if (!isValidToken) return;

    const adminToken = localStorage.getItem('adminToken');
    const adminUser = localStorage.getItem('adminUser');
    
    if (adminToken && adminUser) {
      try {
        const userData = JSON.parse(adminUser);
        if (userData.role === 'SUPERADMIN' || userData.role === 'ADMIN' || userData.role === 'MANAGER') {
          router.push('/admin');
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
  }, [router, isValidToken]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    if (errorMsg) {
      setErrorMsg('');
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!form.email) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(form.email)) {
      newErrors.email = 'Email is invalid';
    }
    
    if (!form.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setLoading(true);
    setErrorMsg('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Login failed. Please check your credentials.');
        return;
      }

      // Only allow admin roles
      if (data.user.role === 'SUPERADMIN' || data.user.role === 'ADMIN' || data.user.role === 'MANAGER') {
        localStorage.setItem('adminToken', data.token);
        localStorage.setItem('adminUser', JSON.stringify(data.user));
        localStorage.setItem('userRole', data.user.role);
        router.push('/admin');
      } else {
        setErrorMsg('Access denied. This portal is for administrators only.');
        // Clear any stored credentials
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } catch (err) {
      console.error('Login error:', err);
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Show token error if invalid
  if (!isValidToken) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-600 via-red-700 to-red-800 flex items-center justify-center p-4">
        <div className="relative w-full max-w-md">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20 text-center"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 bg-red-500/20 backdrop-blur-lg rounded-full mb-4 border border-red-500/30">
              <Key className="w-10 h-10 text-red-300" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Access Denied</h1>
            <p className="text-red-200 mb-6">Invalid security token</p>
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-red-100">
                This secure admin portal requires a valid access token. 
                Please contact your system administrator for the correct URL.
              </p>
            </div>
            <Link
              href="/"
              className="text-sm text-white/70 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              ← Back to main site
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E0061] via-[#1a0a7e] to-[#0E0061] flex items-center justify-center p-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative w-full max-w-md"
      >
        {/* Security Badge */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="inline-flex items-center justify-center w-20 h-20 bg-white/10 backdrop-blur-lg rounded-full mb-4 border border-white/20"
          >
            <Shield className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">Secure Admin Portal</h1>
          <p className="text-white/70">Encrypted Administrator Access</p>
          <div className="mt-2 text-xs text-white/50">
            Token: {params.token?.substring(0, 8)}...
          </div>
        </div>

        {/* Login Card */}
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-2xl p-8 border border-white/20">
          {/* Error Message */}
          <AnimatePresence>
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-lg flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 text-red-300 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-100">{errorMsg}</p>
              </motion.div>
            )}
          </AnimatePresence>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Administrator Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-white/50" />
                </div>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-3 py-3 bg-white/10 border ${
                    errors.email ? 'border-red-500/50' : 'border-white/20'
                  } rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all backdrop-blur-sm`}
                  placeholder="admin@changeworksfund.org"
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-300">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Secure Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-white/50" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className={`block w-full pl-10 pr-12 py-3 bg-white/10 border ${
                    errors.password ? 'border-red-500/50' : 'border-white/20'
                  } rounded-lg text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-white/30 focus:border-transparent transition-all backdrop-blur-sm`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-white/50 hover:text-white transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-300">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <motion.button
              type="submit"
              disabled={loading}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-3 px-4 bg-white text-[#0E0061] font-semibold rounded-lg shadow-lg hover:bg-white/90 focus:outline-none focus:ring-2 focus:ring-white/50 focus:ring-offset-2 focus:ring-offset-[#0E0061] disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <Key className="w-5 h-5" />
                  <span>Secure Login</span>
                </>
              )}
            </motion.button>
          </form>

          {/* Security Notice */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-white/50 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-white/50">
                  This is a secure administrative portal with token-based access control. 
                  Only authorized personnel with valid security tokens can access this area.
                </p>
              </div>
            </div>
          </div>

          {/* Back to Home Link */}
          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-white/70 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              ← Back to main site
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-white/40 text-sm">
            ChangeWorks Fund © 2025 • Secure Token-Based Access
          </p>
        </div>
      </motion.div>
    </div>
  );
}
