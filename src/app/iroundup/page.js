'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { usePlaidLink } from 'react-plaid-link';
import {
  CheckCircle,
  CreditCard,
  Building2,
  Loader2,
  AlertCircle,
  ArrowRight,
  LogIn,
} from 'lucide-react';

// ─── Stripe promise (fetched from mode-aware config) ──────────────────────────
let _stripePromise = null;
function getStripePromise() {
  if (!_stripePromise) {
    _stripePromise = fetch('/api/config/payment-mode')
      .then((r) => r.json())
      .then(({ stripePublishableKey }) =>
        stripePublishableKey?.startsWith('pk_') ? loadStripe(stripePublishableKey) : null
      )
      .catch(() => null);
  }
  return _stripePromise;
}

// ─── Step indicator ───────────────────────────────────────────────────────────
function StepIndicator({ current }) {
  const steps = [
    { n: 1, label: 'Save Card' },
    { n: 2, label: 'Connect Bank' },
    { n: 3, label: 'Done' },
  ];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-colors ${
                current > s.n
                  ? 'bg-green-500 border-green-500 text-white'
                  : current === s.n
                  ? 'bg-[#0E0061] border-[#0E0061] text-white'
                  : 'bg-white border-gray-300 text-gray-400'
              }`}
            >
              {current > s.n ? <CheckCircle className="w-4 h-4" /> : s.n}
            </div>
            <span
              className={`text-xs mt-1 font-medium ${
                current >= s.n ? 'text-[#0E0061]' : 'text-gray-400'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-16 h-0.5 mb-5 mx-1 transition-colors ${
                current > s.n ? 'bg-green-500' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Stripe card form ─────────────────────────────────────────────────────────
function CardForm({ donorToken, orgId, onSuccess, onError }) {
  const stripe = useStripe();
  const elements = useElements();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSaving(true);
    onError('');
    try {
      const { error, token: cardToken } = await stripe.createToken(
        elements.getElement(CardElement)
      );
      if (error) {
        onError(error.message);
        return;
      }
      const res = await fetch('/api/stripe/save-payment-method', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${donorToken}`,
        },
        body: JSON.stringify({ token_id: cardToken.id, organization_id: orgId }),
      });
      const data = await res.json();
      if (!data.success) {
        onError(data.error || 'Failed to save card');
        return;
      }
      onSuccess(data.payment_method);
    } catch {
      onError('Failed to save card. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm focus-within:border-[#0E0061] focus-within:ring-2 focus-within:ring-[#0E0061]/20 transition-all">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#1f2937',
                '::placeholder': { color: '#9ca3af' },
              },
              invalid: { color: '#ef4444' },
            },
          }}
        />
      </div>
      <button
        type="submit"
        disabled={saving || !stripe}
        className="w-full bg-[#0E0061] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#1a0099] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {saving ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Saving card…
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4" />
            Save Card as Funding Source
          </>
        )}
      </button>
    </form>
  );
}

// ─── Plaid connect button ─────────────────────────────────────────────────────
function PlaidConnectButton({ linkToken, onSuccess, onExit }) {
  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: (err) => {
      if (err) onExit('Bank connection was cancelled or failed. Please try again.');
    },
  });

  return (
    <button
      onClick={() => open()}
      disabled={!ready}
      className="w-full bg-[#0E0061] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#1a0099] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {!ready ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          Preparing…
        </>
      ) : (
        <>
          <Building2 className="w-4 h-4" />
          Connect Your Bank Account
        </>
      )}
    </button>
  );
}

// ─── Shell card layout ────────────────────────────────────────────────────────
function Card({ children }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E0061]/5 to-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <img src="/imgs/changeworks.png" alt="ChangeWorks" className="h-10 mx-auto mb-3" />
        </div>
        {children}
      </div>
    </div>
  );
}

// ─── Main content (needs searchParams) ───────────────────────────────────────
function IroundupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 'loading' | 'exists' | 'card' | 'plaid' | 'done' | 'error'
  const [step, setStep] = useState('loading');
  const [donorToken, setDonorToken] = useState(null);
  const [org, setOrg] = useState(null);
  const [donorName, setDonorName] = useState('');
  const [error, setError] = useState('');
  const [linkToken, setLinkToken] = useState(null);
  const [fetchingPlaid, setFetchingPlaid] = useState(false);
  const [stripePromise, setStripePromise] = useState(null);

  // Load stripe on mount
  useEffect(() => {
    setStripePromise(getStripePromise());
  }, []);

  // Init: check/create donor
  useEffect(() => {
    const email = searchParams.get('email');
    const first_name = searchParams.get('first_name');
    const last_name = searchParams.get('last_name');
    const phone = searchParams.get('phone');
    const ghl_id = searchParams.get('ghl_id');

    if (!email || !ghl_id) {
      setError('This link is missing required information. Please contact support.');
      setStep('error');
      return;
    }

    fetch('/api/iroundup/init', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ first_name, last_name, email, phone, ghl_id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
          setStep('error');
          return;
        }
        if (data.exists) {
          setOrg(data.organization);
          setStep('exists');
        } else {
          setDonorToken(data.token);
          setOrg(data.organization);
          setDonorName(data.donor.name);
          setStep('card');
        }
      })
      .catch(() => {
        setError('Network error. Please refresh and try again.');
        setStep('error');
      });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch Plaid link token once we move to the plaid step
  useEffect(() => {
    if (step !== 'plaid' || linkToken || !donorToken || !org) return;
    setFetchingPlaid(true);
    fetch('/api/plaid/create-link-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${donorToken}`,
      },
      body: JSON.stringify({ organization_id: org.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setLinkToken(data.link_token);
        else setError('Failed to prepare bank connection. Please refresh.');
      })
      .catch(() => setError('Failed to prepare bank connection. Please refresh.'))
      .finally(() => setFetchingPlaid(false));
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCardSaved = () => {
    setError('');
    setStep('plaid');
  };

  const handlePlaidSuccess = useCallback(
    async (publicToken, metadata) => {
      setError('');
      try {
        const res = await fetch('/api/plaid/exchange-token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${donorToken}`,
          },
          body: JSON.stringify({
            public_token: publicToken,
            metadata,
            organization_id: org.id,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || 'Failed to connect bank. Please try again.');
          return;
        }
        setStep('done');
        setTimeout(() => router.push('/donor/login'), 3500);
      } catch {
        setError('Failed to connect bank. Please try again.');
      }
    },
    [donorToken, org, router]
  );

  // ── Render: loading ──────────────────────────────────────────────────────────
  if (step === 'loading') {
    return (
      <Card>
        <div className="flex flex-col items-center py-8 text-gray-500 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#0E0061]" />
          <p className="text-sm">Setting up your account…</p>
        </div>
      </Card>
    );
  }

  // ── Render: error ────────────────────────────────────────────────────────────
  if (step === 'error') {
    return (
      <Card>
        <div className="flex flex-col items-center text-center gap-4 py-4">
          <AlertCircle className="w-12 h-12 text-red-500" />
          <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
          <p className="text-gray-500 text-sm">{error}</p>
          <a
            href="mailto:support@changeworksfund.org"
            className="text-[#0E0061] text-sm underline"
          >
            Contact support
          </a>
        </div>
      </Card>
    );
  }

  // ── Render: donor already exists ──────────────────────────────────────────
  if (step === 'exists') {
    return (
      <Card>
        <div className="flex flex-col items-center text-center gap-5 py-4">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
            <LogIn className="w-7 h-7 text-[#0E0061]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              You already have an account
            </h2>
            <p className="text-gray-500 text-sm">
              We found an existing donor account with your email
              {org?.name ? ` for ${org.name}` : ''}. Please log in to manage
              your round-up settings.
            </p>
          </div>
          <a
            href="/donor/login"
            className="w-full bg-[#0E0061] text-white py-3 px-6 rounded-xl font-semibold hover:bg-[#1a0099] transition-colors text-center flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Go to Login
          </a>
        </div>
      </Card>
    );
  }

  // ── Render: done ──────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <Card>
        <div className="flex flex-col items-center text-center gap-5 py-4">
          <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center">
            <CheckCircle className="w-9 h-9 text-green-500" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              You&apos;re all set!
            </h2>
            <p className="text-gray-500 text-sm">
              Your card and bank account have been connected. Your round-up donations
              are active. Check your email for your login credentials.
            </p>
          </div>
          <p className="text-xs text-gray-400">Redirecting to login page…</p>
          <a
            href="/donor/login"
            className="text-[#0E0061] text-sm underline font-medium"
          >
            Go now →
          </a>
        </div>
      </Card>
    );
  }

  // ── Render: card + plaid steps ────────────────────────────────────────────
  const currentStep = step === 'card' ? 1 : 2;

  return (
    <Card>
      {/* Greeting */}
      <h1 className="text-2xl font-bold text-gray-900 text-center mb-1">
        {org?.name ? `${org.name}` : 'Round-Up Setup'}
      </h1>
      <p className="text-center text-gray-500 text-sm mb-6">
        Hi {donorName ? donorName.split(' ')[0] : 'there'}! Let&apos;s set up your round-up
        donations in two quick steps.
      </p>

      <StepIndicator current={currentStep} />

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm mb-4">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Step 1: Stripe card */}
      {step === 'card' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#0E0061]/10 flex items-center justify-center">
              <CreditCard className="w-4 h-4 text-[#0E0061]" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Step 1: Funding Source</p>
              <p className="text-xs text-gray-500">
                Add a card — this is charged for your monthly round-up total.
              </p>
            </div>
          </div>

          {stripePromise ? (
            <Elements stripe={stripePromise}>
              <CardForm
                donorToken={donorToken}
                orgId={org?.id}
                onSuccess={handleCardSaved}
                onError={setError}
              />
            </Elements>
          ) : (
            <div className="flex items-center justify-center py-8 text-gray-400 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span className="text-sm">Loading payment form…</span>
            </div>
          )}
        </div>
      )}

      {/* Step 2: Plaid bank */}
      {step === 'plaid' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-full bg-[#0E0061]/10 flex items-center justify-center">
              <Building2 className="w-4 h-4 text-[#0E0061]" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Step 2: Spending Source</p>
              <p className="text-xs text-gray-500">
                Connect your bank account so we can track purchases and calculate round-ups.
              </p>
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-green-700 mb-2">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            Card saved successfully!
          </div>

          {fetchingPlaid && (
            <div className="flex items-center justify-center py-4 text-gray-400 gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Preparing bank connection…</span>
            </div>
          )}

          {linkToken && !fetchingPlaid && (
            <PlaidConnectButton
              linkToken={linkToken}
              onSuccess={handlePlaidSuccess}
              onExit={(msg) => setError(msg)}
            />
          )}
        </div>
      )}
    </Card>
  );
}

// ─── Page export — wrap in Suspense for useSearchParams ──────────────────────
export default function IroundupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-[#0E0061]" />
        </div>
      }
    >
      <IroundupContent />
    </Suspense>
  );
}
