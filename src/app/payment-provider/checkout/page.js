/**
 * /payment-provider/checkout
 * GHL custom payment provider checkout iframe.
 * Supports one-time PaymentIntents and recurring Subscriptions.
 * Must remain publicly accessible (no auth) — embedded as iframe by GHL.
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

function postToParent(msg) {
  window.parent.postMessage(JSON.stringify(msg), '*');
}

function reportHeight() {
  const h = document.documentElement.scrollHeight;
  postToParent({ type: 'set_height', height: h });
}

function friendlyError(stripeError) {
  if (!stripeError) return 'An unexpected error occurred. Please try again.';
  switch (stripeError.code) {
    case 'card_declined':       return 'Your card was declined. Please use a different card.';
    case 'insufficient_funds':  return 'Your card has insufficient funds.';
    case 'expired_card':        return 'Your card has expired. Please use a different card.';
    case 'incorrect_cvc':       return 'The security code (CVC) is incorrect.';
    case 'incorrect_number':    return 'The card number is incorrect.';
    case 'invalid_expiry_month':
    case 'invalid_expiry_year': return 'The card expiry date is invalid.';
    case 'processing_error':    return 'An error occurred while processing your card. Please try again.';
    default:                    return stripeError.message || 'Payment failed. Please try again.';
  }
}

function CheckoutForm({ mode, subscriptionId, onSuccess, onError }) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [complete, setComplete] = useState(false);

  useEffect(() => {
    const t = setTimeout(reportHeight, 300);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setLoading(true);
    setError(null);

    const { error: submitErr } = await elements.submit();
    if (submitErr) { setError(friendlyError(submitErr)); setLoading(false); return; }

    const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (confirmErr) {
      const msg = friendlyError(confirmErr);
      setError(msg); setLoading(false); onError?.(msg);
      return;
    }

    if (paymentIntent?.status === 'succeeded') {
      setComplete(true); setLoading(false);
      onSuccess?.(subscriptionId ?? paymentIntent.id, mode);
      return;
    }

    const msg = `Payment status: ${paymentIntent?.status ?? 'unknown'}. Please try again.`;
    setError(msg); setLoading(false); onError?.(msg);
  }

  if (complete) {
    return (
      <div style={{ textAlign: 'center', padding: '24px 0' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#166534' }}>Payment successful!</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginTop: 6 }}>
          {mode === 'subscription' ? 'Your subscription is now active.' : 'Your payment has been processed.'}
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PaymentElement onReady={reportHeight} onChange={() => setError(null)} />
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
          <span style={{ fontSize: 16, flexShrink: 0 }}>⚠️</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b', marginBottom: 2 }}>Payment failed</div>
            <div style={{ fontSize: 13, color: '#b91c1c' }}>{error}</div>
          </div>
        </div>
      )}
      <button
        type="submit"
        disabled={!stripe || loading}
        style={{
          background: loading ? '#a5b4fc' : '#0E0061', color: '#fff', border: 'none',
          padding: '14px 0', borderRadius: 8, fontSize: 15, fontWeight: 600,
          cursor: loading ? 'not-allowed' : 'pointer', transition: 'background .2s',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%',
        }}
      >
        {loading
          ? <><span style={{ display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Processing…</>
          : <>{mode === 'subscription' ? '🔒 Subscribe Now' : '🔒 Pay Now'}</>
        }
      </button>
    </form>
  );
}

export default function CheckoutPage() {
  const [stripePromise,  setStripePromise]  = useState(null);
  const [clientSecret,   setClientSecret]   = useState(null);
  const [mode,           setMode]           = useState('payment');
  const [subscriptionId, setSubscriptionId] = useState(null);
  const [pageError,      setPageError]      = useState(null);
  const [ready,          setReady]          = useState(false);
  const initDataRef = useRef(null);

  function handleRetry() {
    initDataRef.current = null;
    setPageError(null); setReady(false); setClientSecret(null);
    setStripePromise(null); setSubscriptionId(null);
  }

  const initPayment = useCallback((msg) => {
    const {
      publishableKey, clientSecret, amount, currency, locationId, transactionId, orderId,
      entityId, entityType, contactId, priceId, subscriptionId: ghlSubscriptionId,
      interval, recurring, contact, email, firstName, lastName, phone,
    } = msg;

    const contactObj    = contact ?? {};
    const customerEmail = email     || contactObj.email     || null;
    const customerPhone = phone     || contactObj.phone     || null;
    const customerFirst = firstName || contactObj.firstName || null;
    const customerLast  = lastName  || contactObj.lastName  || null;
    const customerName  = (customerFirst || customerLast) ? [customerFirst, customerLast].filter(Boolean).join(' ') : null;
    const resolvedCurrency   = (currency || 'usd').toLowerCase();
    const resolvedEntityId   = entityId || transactionId || orderId || `ghl-${Date.now()}`;
    const resolvedEntityType = entityType || null;
    const amountCents        = amount ? Math.round(Number(amount) * 100) : undefined;
    const resolvedInterval   = interval || null;
    const isRecurring        = recurring === true || recurring === 'true' || !!interval;

    if (clientSecret && publishableKey) {
      setMode(isRecurring ? 'subscription' : 'payment');
      setClientSecret(clientSecret);
      setStripePromise(loadStripe(publishableKey, { stripeAccount: undefined }));
      setReady(true);
      return;
    }

    fetch('/api/payment-provider/payments/create-intent', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        locationId,
        ...(priceId           ? { priceId }              : {}),
        ...(amountCents       ? { amount: amountCents }  : {}),
        ...(ghlSubscriptionId ? { ghlSubscriptionId }    : {}),
        currency: resolvedCurrency, entityId: resolvedEntityId, entityType: resolvedEntityType,
        interval: resolvedInterval, isRecurring: isRecurring || undefined,
        metadata: {
          ghlTransactionId:  transactionId     ?? null,
          ghlSubscriptionId: ghlSubscriptionId ?? null,
          ghlOrderId:        orderId           ?? null,
          ghlEntityId:       entityId          ?? null,
          ghlContactId:      contactId         ?? null,
          customerName, customerEmail, customerPhone,
        },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        console.log('[Checkout] create-intent response:', JSON.stringify(data));
        if (data.error) { console.error('[Checkout] create-intent error:', data.error); setPageError(data.error); return; }
        setMode(data.mode ?? 'payment');
        setSubscriptionId(data.subscriptionId ?? null);
        setClientSecret(data.clientSecret);
        setStripePromise(loadStripe(publishableKey || data.publishableKey, { ...(data.stripeAccountId ? { stripeAccount: data.stripeAccountId } : {}) }));
        setReady(true);
      })
      .catch((err) => { console.error('[Checkout] create-intent fetch failed:', err); setPageError('Could not connect to payment server. Please try again.'); });
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(reportHeight);
    ro.observe(document.documentElement);
    window.parent.postMessage(JSON.stringify({ type: 'custom_provider_ready', loaded: true }), '*');
    const readyInterval = setInterval(() => {
      if (!initDataRef.current) window.parent.postMessage(JSON.stringify({ type: 'custom_provider_ready', loaded: true }), '*');
    }, 500);

    function onMessage(event) {
      let msg = event.data;
      if (typeof msg === 'string') { try { msg = JSON.parse(msg); } catch { return; } }
      if (!msg) return;
      console.log('[Checkout] postMessage received:', msg.type, JSON.stringify(msg));
      if (msg.type !== 'payment_initiate_props') return;
      if (initDataRef.current) return;
      clearInterval(readyInterval);
      initDataRef.current = msg;
      console.log('[Checkout] Initialising payment with:', JSON.stringify(msg));
      initPayment(msg);
    }

    window.addEventListener('message', onMessage);
    return () => { clearInterval(readyInterval); window.removeEventListener('message', onMessage); ro.disconnect(); };
  }, [initPayment]);

  function handleSuccess(chargeId) {
    postToParent({ type: 'custom_element_success_response', chargeId });
  }
  function handleError(description) {
    postToParent({ type: 'custom_element_error_response', error: { description } });
  }

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: transparent; min-height: 100%; }
        .checkout-wrapper { display: flex; justify-content: center; align-items: flex-start; padding: 24px 16px; }
        .checkout-card { width: 100%; max-width: 520px; background: #ffffff; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); padding: 32px 28px; }
        .checkout-header { text-align: center; margin-bottom: 24px; }
        .checkout-header .lock-icon { font-size: 22px; margin-bottom: 6px; }
        .checkout-header h2 { font-size: 18px; font-weight: 700; color: #111827; margin-bottom: 4px; }
        .checkout-header p { font-size: 13px; color: #6b7280; }
        .divider { border: none; border-top: 1px solid #e5e7eb; margin: 20px 0; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div className="checkout-wrapper">
        <div className="checkout-card">
          <div className="checkout-header">
            <div className="lock-icon">🔒</div>
            <h2>Secure Payment</h2>
            <p>{mode === 'subscription' ? 'Set up your recurring subscription' : 'Your payment info is encrypted and secure'}</p>
          </div>
          <hr className="divider" />

          {pageError && (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#991b1b', marginBottom: 2 }}>Unable to load payment</div>
                  <div style={{ fontSize: 13, color: '#b91c1c' }}>{pageError}</div>
                </div>
              </div>
              <button onClick={handleRetry} style={{ width: '100%', padding: 10, background: '#dc2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Try Again
              </button>
            </div>
          )}

          {!pageError && !ready && (
            <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #e5e7eb', borderTopColor: '#0E0061', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              <p style={{ marginTop: 12, color: '#6b7280', fontSize: 14 }}>Loading payment form…</p>
            </div>
          )}

          {ready && clientSecret && stripePromise && (
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: { theme: 'stripe', variables: { borderRadius: '8px', colorPrimary: '#0E0061' } } }}>
              <CheckoutForm mode={mode} subscriptionId={subscriptionId} onSuccess={handleSuccess} onError={handleError} />
            </Elements>
          )}

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 12, color: '#9ca3af' }}>
            🔐 256-bit SSL encrypted · Powered by Stripe
          </p>
        </div>
      </div>
    </>
  );
}
