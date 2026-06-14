'use client';

import { useSearchParams } from 'next/navigation';

const reasonMessages = {
  missing_token: 'Verification token is missing.',
  invalid_or_expired: 'This verification link is invalid or has already been used.',
  expired: 'This verification link has expired. Please request a new one.',
  donor_not_found: 'We could not find your account. Please contact support.',
  server_error: 'Something went wrong on our end. Please try again later.'
};

export default function VerifyErrorPage() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');
  const message = reasonMessages[reason] || 'Verification failed. Please try again.';

  return (
    <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center py-16 px-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-red-100 p-8">
        <div className="text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
            <span className="text-3xl">❌</span>
          </div>
          <h1 className="text-3xl font-bold text-red-700">Verification Failed</h1>
          <p className="mt-2 text-gray-600">{message}</p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <a
              href="/login"
              className="inline-flex items-center px-6 py-3 bg-gray-800 hover:bg-black text-white font-medium rounded-lg shadow-sm transition"
            >
              Go to Login
            </a>
            <a
              href="/organization/signup"
              className="inline-flex items-center px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg shadow-sm transition"
            >
              Sign up again
            </a>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Need help? Contact support at <a href="mailto:info@rapidtechpro.com" className="text-red-700 underline">info@rapidtechpro.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
