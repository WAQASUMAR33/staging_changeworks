'use client';

import { useState, useEffect } from 'react';
import { Shield, CheckCircle, X, Loader2, AlertCircle, Copy, Eye, EyeOff } from 'lucide-react';
import Image from 'next/image';

export default function TwoFactorSetup({ userType = 'user', onSuccess }) {
  const [loading, setLoading] = useState(false);

  const getToken = () => {
    if (userType === 'organization') {
      const orgToken = sessionStorage.getItem('orgToken');
      if (orgToken) return orgToken;
    }
    return localStorage.getItem('token') || localStorage.getItem('adminToken');
  };
  const [status, setStatus] = useState(null); // null, 'enabled', 'disabled', 'setting-up'
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [showDisableForm, setShowDisableForm] = useState(false);

  // Check 2FA status on mount
  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const token = getToken();
      if (!token) return;

      const response = await fetch(`/api/two-factor/status?userType=${userType}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();
      if (data.success) {
        setStatus(data.twoFactorEnabled ? 'enabled' : 'disabled');
      }
    } catch (error) {
      console.error('Error checking 2FA status:', error);
    }
  };

  const handleEnable = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = getToken();
      if (!token) {
        setError('Please log in to enable two-factor authentication');
        return;
      }

      const response = await fetch('/api/two-factor/enable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ userType }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setStatus('setting-up');
        setSuccess(data.message);
      } else {
        setError(data.error || 'Failed to enable two-factor authentication');
      }
    } catch (error) {
      console.error('Error enabling 2FA:', error);
      setError('Failed to enable two-factor authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifySetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a valid 6-digit code');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = getToken();
      if (!token) {
        setError('Please log in to verify two-factor authentication');
        return;
      }

      const response = await fetch('/api/two-factor/verify-setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ token: verificationCode, userType }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('enabled');
        setQrCode(null);
        setSecret(null);
        setVerificationCode('');
        setSuccess('Two-factor authentication has been successfully enabled!');
        if (onSuccess) onSuccess();
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      } else {
        setError(data.error || 'Invalid verification code. Please try again.');
      }
    } catch (error) {
      console.error('Error verifying 2FA setup:', error);
      setError('Failed to verify two-factor authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable = async () => {
    if (!disablePassword) {
      setError('Password is required to disable two-factor authentication');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = getToken();
      if (!token) {
        setError('Please log in to disable two-factor authentication');
        return;
      }

      const response = await fetch('/api/two-factor/disable', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ password: disablePassword, userType }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('disabled');
        setDisablePassword('');
        setShowDisableForm(false);
        setSuccess('Two-factor authentication has been successfully disabled.');
        if (onSuccess) onSuccess();
        setTimeout(() => {
          setSuccess('');
        }, 5000);
      } else {
        setError(data.error || 'Failed to disable two-factor authentication');
      }
    } catch (error) {
      console.error('Error disabling 2FA:', error);
      setError('Failed to disable two-factor authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copySecret = () => {
    if (secret) {
      navigator.clipboard.writeText(secret);
      setSuccess('Secret copied to clipboard!');
      setTimeout(() => setSuccess(''), 2000);
    }
  };

  if (status === 'enabled') {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
              <p className="text-sm text-gray-500">Enabled</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-green-600">Active</span>
          </div>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {!showDisableForm ? (
          <button
            onClick={() => setShowDisableForm(true)}
            className="w-full px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition-colors duration-200 font-medium"
          >
            Disable Two-Factor Authentication
          </button>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter your password to disable 2FA
              </label>
              <div className="relative">
                <input
                  type={showSecret ? 'text' : 'password'}
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showSecret ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => {
                  setShowDisableForm(false);
                  setDisablePassword('');
                  setError('');
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDisable}
                disabled={loading}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Disabling...
                  </>
                ) : (
                  'Disable 2FA'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (status === 'setting-up') {
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
            <Shield className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Set Up Two-Factor Authentication</h3>
            <p className="text-sm text-gray-500">Scan the QR code with your authenticator app</p>
          </div>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* QR Code */}
          <div className="flex justify-center">
            <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
              {qrCode && (
                <Image
                  src={qrCode}
                  alt="2FA QR Code"
                  width={200}
                  height={200}
                  className="w-48 h-48"
                />
              )}
            </div>
          </div>

          {/* Secret Key */}
          {secret && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or enter this code manually:
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={secret}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                />
                <button
                  onClick={copySecret}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors duration-200"
                  title="Copy secret"
                >
                  <Copy className="w-5 h-5" />
                </button>
              </div>
            </div>
          )}

          {/* Verification Code Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Enter the 6-digit code from your authenticator app:
            </label>
            <input
              type="text"
              value={verificationCode}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, '').slice(0, 6);
                setVerificationCode(value);
                setError('');
              }}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-center text-2xl font-mono tracking-widest"
              placeholder="000000"
              maxLength={6}
            />
          </div>

          <button
            onClick={handleVerifySetup}
            disabled={loading || verificationCode.length !== 6}
            className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Verifying...
              </>
            ) : (
              'Verify and Enable'
            )}
          </button>

          <button
            onClick={() => {
              setStatus('disabled');
              setQrCode(null);
              setSecret(null);
              setVerificationCode('');
              setError('');
              setSuccess('');
            }}
            className="w-full px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // Disabled state
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
      <div className="flex items-center space-x-3 mb-4">
        <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
          <Shield className="w-6 h-6 text-gray-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Two-Factor Authentication</h3>
          <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <div className="space-y-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h4 className="font-medium text-blue-900 mb-2">How it works:</h4>
          <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
            <li>Scan the QR code with an authenticator app (Google Authenticator, Authy, etc.)</li>
            <li>Enter the 6-digit code to verify setup</li>
            <li>You'll need to enter a code each time you log in</li>
          </ul>
        </div>

        <button
          onClick={handleEnable}
          disabled={loading}
          className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center justify-center"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Setting up...
            </>
          ) : (
            <>
              <Shield className="w-5 h-5 mr-2" />
              Enable Two-Factor Authentication
            </>
          )}
        </button>
      </div>
    </div>
  );
}




