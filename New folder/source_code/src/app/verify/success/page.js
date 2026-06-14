'use client';

import { useSearchParams } from 'next/navigation';

export default function VerifySuccessPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email');
  const note = searchParams.get('note');

  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center py-16 px-6">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-green-100 p-8">
        <div className="text-center">
          <div className="mx-auto mb-6 h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
            <span className="text-3xl">✅</span>
          </div>
          <h1 className="text-3xl font-bold text-green-700">Email Verified Successfully</h1>
          <p className="mt-2 text-gray-600">
            {email ? (
              <>Your email <span className="font-semibold text-gray-800">{email}</span> has been verified.</>
            ) : (
              <>Your email has been verified and your account is now active.</>
            )}
          </p>

          {note === 'email_not_sent' && (
            <div className="mt-4 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-4 py-2 inline-block">
              Verification success email could not be sent. You&apos;re all set anyway!
            </div>
          )}

          <div className="mt-8">
            <a
              href="/login"
              className="inline-flex items-center px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg shadow-sm transition"
            >
              Go to Login
            </a>
          </div>

          <div className="mt-6 text-sm text-gray-500">
            Need help? Contact support at <a href="mailto:info@rapidtechpro.com" className="text-green-700 underline">info@rapidtechpro.com</a>
          </div>
        </div>
      </div>
    </div>
  );
}
