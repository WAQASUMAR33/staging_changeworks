'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, ExternalLink } from 'lucide-react';

export default function SubscriptionSuccessPage() {
  const searchParams = useSearchParams();
  const [verificationStatus, setVerificationStatus] = useState('loading'); // 'loading', 'success', 'error'
  const [subscriptionData, setSubscriptionData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const sessionId = searchParams.get('session_id');
    const donorId = searchParams.get('donor_id');
    const organizationId = searchParams.get('organization_id');
    
    if (sessionId && donorId && organizationId) {
      verifySubscription(sessionId, donorId, organizationId);
    } else {
      setVerificationStatus('error');
      setError('Missing required parameters: session_id, donor_id, or organization_id');
    }
  }, [searchParams, verifySubscription]);

  const verifySubscription = useCallback(async (sessionId, donorId, organizationId) => {
    try {
      setVerificationStatus('loading');
      
      // First, try to verify and create subscription record
      const response = await fetch('/api/verify-subscription-success', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          session_id: sessionId,
          donor_id: parseInt(donorId),
          organization_id: parseInt(organizationId)
        }),
      });

      const result = await response.json();

      if (result.success) {
        setVerificationStatus('success');
        setSubscriptionData(result.subscription);
      } else {
        // If verify API fails, try manual sync
        console.log('Verify API failed, trying manual sync...');
        await manualSync(donorId, organizationId);
      }
    } catch (err) {
      console.log('Verify API error, trying manual sync...');
      await manualSync(donorId, organizationId);
    }
  }, [manualSync]);

  const manualSync = useCallback(async (donorId, organizationId) => {
    try {
      const syncResponse = await fetch('/api/sync-donor-subscriptions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          donor_id: parseInt(donorId),
          organization_id: parseInt(organizationId)
        }),
      });

      const syncResult = await syncResponse.json();

      if (syncResult.success && syncResult.synced_subscriptions > 0) {
        setVerificationStatus('success');
        setSubscriptionData({
          donor_id: parseInt(donorId),
          organization_id: parseInt(organizationId),
          status: 'ACTIVE',
          message: 'Subscription synced successfully'
        });
      } else {
        setVerificationStatus('error');
        setError('Payment completed but subscription record could not be created. Please contact support.');
      }
    } catch (syncErr) {
      setVerificationStatus('error');
      setError('Network error occurred while creating subscription record');
      console.error('Sync error:', syncErr);
    }
  }, []);

  const renderLoadingState = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Verifying Your Subscription
        </h2>
        <p className="text-gray-600">
          Please wait while we confirm your payment and set up your subscription...
        </p>
      </div>
    </div>
  );

  const renderSuccessState = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white rounded-lg shadow-lg p-8">
        <div className="text-center mb-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Subscription Successful!
          </h1>
          <p className="text-gray-600">
            Your subscription has been activated and you&apos;re all set to start using our services.
          </p>
        </div>

        {subscriptionData && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <h3 className="text-lg font-semibold text-green-800 mb-4">
              Subscription Details
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-green-700">Customer</label>
                <p className="text-green-900">{subscriptionData.donor?.name}</p>
                <p className="text-sm text-green-600">{subscriptionData.donor?.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-green-700">Package</label>
                <p className="text-green-900">{subscriptionData.package?.name}</p>
                <p className="text-sm text-green-600">
                  ${subscriptionData.amount}/{subscriptionData.currency}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-green-700">Status</label>
                <p className="text-green-900 capitalize">{subscriptionData.status.toLowerCase()}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-green-700">Next Billing</label>
                <p className="text-green-900">
                  {new Date(subscriptionData.current_period_end).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="text-center">
          <button
            onClick={() => window.location.href = '/organization/dashboard'}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors inline-flex items-center"
          >
            Go to Dashboard
            <ExternalLink className="w-4 h-4 ml-2" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderErrorState = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Verification Failed
        </h2>
        <p className="text-gray-600 mb-6">
          {error || 'We encountered an issue while verifying your subscription.'}
        </p>
        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
          <button
            onClick={() => window.location.href = '/contact'}
            className="w-full bg-gray-200 text-gray-800 px-6 py-3 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  );

  switch (verificationStatus) {
    case 'loading':
      return renderLoadingState();
    case 'success':
      return renderSuccessState();
    case 'error':
      return renderErrorState();
    default:
      return renderLoadingState();
  }
}
