'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wifi, WifiOff, CreditCard, RefreshCw, Package,
  CheckCircle, AlertCircle, XCircle, ExternalLink, Loader2,
  ChevronRight, DollarSign, BarChart2, Zap, Unplug, Bug, ChevronDown, ChevronUp,
} from 'lucide-react';

// ─── Helper ───────────────────────────────────────────────────────────────────

function currency(amount, cur = 'usd') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur.toUpperCase() }).format((amount ?? 0) / 100);
}

function Badge({ status }) {
  const map = {
    active:    { label: 'Active',        cls: 'bg-green-100 text-green-700' },
    inactive:  { label: 'Inactive',      cls: 'bg-gray-100 text-gray-600' },
    incomplete:{ label: 'Incomplete',    cls: 'bg-yellow-100 text-yellow-700' },
    live:      { label: 'Live Mode',     cls: 'bg-green-100 text-green-700' },
    test:      { label: 'Test Mode',     cls: 'bg-yellow-100 text-yellow-700' },
    succeeded: { label: 'Succeeded',     cls: 'bg-green-100 text-green-700' },
    requires_payment_method: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
    canceled:  { label: 'Canceled',      cls: 'bg-red-100 text-red-700' },
    processing:{ label: 'Processing',    cls: 'bg-blue-100 text-blue-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>{label}</span>;
}

// ─── Debug Row ────────────────────────────────────────────────────────────────

function DebugRow({ label, ok, children }) {
  return (
    <div className={`rounded-xl border p-4 ${ok === true ? 'border-green-100 bg-green-50/40' : ok === false ? 'border-red-100 bg-red-50/40' : 'border-gray-100 bg-gray-50/40'}`}>
      <div className="flex items-center gap-2 mb-1">
        {ok === true  ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        : ok === false ? <XCircle    className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
        :                <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />}
        <span className="text-xs font-semibold text-gray-700 font-mono">{label}</span>
      </div>
      <div className="text-gray-600 pl-5">{children}</div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PaymentProviderPage() {
  const [locationId,     setLocationId]     = useState('');
  const [stripeStatus,   setStripeStatus]   = useState(null);
  const [loading,        setLoading]        = useState(false);
  const [statusMsg,      setStatusMsg]      = useState('');
  const [error,          setError]          = useState('');
  const [tab,            setTab]            = useState('dashboard');
  const [directId,       setDirectId]       = useState('');
  const [showDirect,     setShowDirect]     = useState(false);
  const [autoConnecting, setAutoConnecting] = useState(false);
  const [orgStripeAccountId, setOrgStripeAccountId] = useState('');
  const [providerResult, setProviderResult] = useState(null);
  const [providerLoading,setProviderLoading]= useState(false);
  const [showDebug,      setShowDebug]      = useState(false);

  // Transactions
  const [transactions, setTransactions] = useState([]);
  const [txLoading,    setTxLoading]    = useState(false);
  const [txHasMore,    setTxHasMore]    = useState(false);
  const [txCursor,     setTxCursor]     = useState(null);

  // Products
  const [products,    setProducts]    = useState([]);
  const [prodLoading, setProdLoading] = useState(false);
  const [prodHasMore, setProdHasMore] = useState(false);
  const [prodCursor,  setProdCursor]  = useState(null);
  const [prodError,   setProdError]   = useState('');
  const [prodForm,    setProdForm]    = useState({ name: '', description: '', price: '', currency: 'usd', type: 'one_time', interval: 'month' });
  const [prodFormOpen,setProdFormOpen]= useState(false);
  const [prodSaving,  setProdSaving]  = useState(false);
  const [editProduct, setEditProduct] = useState(null);
  const [editSaving,  setEditSaving]  = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult,  setSyncResult]  = useState(null);

  // Webhook registration
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookResult,  setWebhookResult]  = useState(null);

  // ── Init: fetch org connection info from DB ───────────────────────────────
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const locFromUrl = sp.get('locationId') ?? '';

    if (locFromUrl) {
      setLocationId(locFromUrl);
      const connected = sp.get('connected');
      const onboarding = sp.get('onboarding');
      if (connected === 'ghl') {
        setStatusMsg('GHL account connected successfully! Activating payment provider…');
        setTimeout(() => registerProviderFor(locFromUrl), 800);
      }
      if (connected === 'stripe') setStatusMsg('Stripe account connected successfully!');
      if (onboarding === 'complete') setStatusMsg('Stripe onboarding complete!');
      if (sp.get('error')) setError(`Error: ${sp.get('error')}`);
      window.history.replaceState({}, '', `/organization/dashboard/payment-provider?locationId=${locFromUrl}`);
    } else {
      // Fetch stripeAccountId + ghlLocationId directly from DB
      try {
        const orgUser = JSON.parse(sessionStorage.getItem('orgUser') ?? '{}');
        if (orgUser.id) {
          fetch(`/api/organization/connection-info?organizationId=${orgUser.id}`)
            .then(r => r.json())
            .then(d => {
              if (d.success) {
                const locId = d.ghlLocationId || orgUser.ghlId || '';
                if (locId) setLocationId(locId);
                if (d.orgStripeAccountId) setOrgStripeAccountId(d.orgStripeAccountId);
                // Auto-connect: prefer already-connected account, fall back to org's stripeAccountId
                const accountToConnect = d.stripeAccountId || d.orgStripeAccountId;
                if (locId && accountToConnect) {
                  autoConnectStripe(locId, accountToConnect);
                }
              }
            })
            .catch(() => {});
        }
      } catch {}
    }
  }, []);

  // ── Fetch Stripe status ───────────────────────────────────────────────────
  const fetchStripeStatus = useCallback(async (locId) => {
    if (!locId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/payment-provider/connect/account?locationId=${locId}`);
      const d = await r.json();
      setStripeStatus(d);

      // If still not connected, try to auto-connect using org's stripeAccountId
      if (!d.connected) {
        try {
          const orgUser = JSON.parse(sessionStorage.getItem('orgUser') ?? '{}');
          if (orgUser.id) {
            const infoR = await fetch(`/api/organization/connection-info?organizationId=${orgUser.id}`);
            const info  = await infoR.json();
            const accountToConnect = info.stripeAccountId || info.orgStripeAccountId;
            if (info.success && accountToConnect) {
              if (info.orgStripeAccountId) setOrgStripeAccountId(info.orgStripeAccountId);
              await autoConnectStripe(locId, accountToConnect);
            }
          }
        } catch {}
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (locationId) fetchStripeStatus(locationId); }, [locationId, fetchStripeStatus]);

  // ── Transactions ──────────────────────────────────────────────────────────
  const fetchTransactions = useCallback(async (locId, cursor = null) => {
    if (!locId) return;
    setTxLoading(true);
    try {
      const url = `/api/payment-provider/payments/transactions?locationId=${locId}&limit=25${cursor ? `&startingAfter=${cursor}` : ''}`;
      const r = await fetch(url);
      const d = await r.json();
      if (cursor) setTransactions(prev => [...prev, ...(d.transactions ?? [])]);
      else        setTransactions(d.transactions ?? []);
      setTxHasMore(d.hasMore ?? false);
      setTxCursor(d.nextCursor ?? null);
    } catch (e) {
      setError(e.message);
    } finally {
      setTxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'transactions' && locationId) { setTxCursor(null); fetchTransactions(locationId, null); }
  }, [tab, locationId, fetchTransactions]);

  // ── Products ──────────────────────────────────────────────────────────────
  const fetchProducts = useCallback(async (locId, cursor = null) => {
    if (!locId) return;
    setProdLoading(true); setProdError('');
    try {
      const url = `/api/payment-provider/products?locationId=${locId}&limit=20${cursor ? `&startingAfter=${cursor}` : ''}`;
      const r = await fetch(url);
      const d = await r.json();
      if (!r.ok) { setProdError(d.error ?? 'Failed to load products'); return; }
      if (cursor) setProducts(prev => [...prev, ...(d.products ?? [])]);
      else        setProducts(d.products ?? []);
      setProdHasMore(d.hasMore ?? false);
      setProdCursor(d.nextCursor ?? null);
    } catch (e) { setProdError(e.message); }
    finally { setProdLoading(false); }
  }, []);

  useEffect(() => {
    if (tab === 'products' && locationId) { setProdCursor(null); fetchProducts(locationId, null); }
  }, [tab, locationId, fetchProducts]);

  // ── Actions ───────────────────────────────────────────────────────────────
  // ── Auto-connect Stripe account from DB ──────────────────────────────────
  async function autoConnectStripe(locId, stripeAccId) {
    setAutoConnecting(true);
    try {
      const r = await fetch('/api/payment-provider/connect/direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId: locId, stripeAccountId: stripeAccId }),
      });
      const d = await r.json();
      if (r.ok) {
        setStripeStatus({ ...d });
        // Re-fetch full status after connection is saved
        await fetchStripeStatus(locId);
      }
    } catch {}
    finally { setAutoConnecting(false); }
  }

  function connectGHL() {
    // Server-side route builds the GHL OAuth URL using GHL_APP_CLIENT_ID (never exposed to browser)
    window.open('/api/payment-provider/auth/ghl', '_blank');
  }
  function connectStripe() {
    if (!locationId) { setError('Enter a Location ID first.'); return; }
    window.location.href = `/api/payment-provider/auth/stripe?locationId=${locationId}`;
  }
  async function connectDirect() {
    if (!locationId) { setError('Enter a Location ID first.'); return; }
    if (!directId)   { setError('Enter a Stripe Account ID (acct_...).'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/payment-provider/connect/direct', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId, stripeAccountId: directId.trim() }) });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Failed to connect'); return; }
      setStripeStatus({ ...d }); setStatusMsg(`Stripe account ${d.stripeAccountId} connected!`);
      setShowDirect(false); setDirectId('');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function startOnboarding() {
    setLoading(true);
    try {
      const r = await fetch('/api/payment-provider/connect/onboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId }) });
      const d = await r.json();
      if (d.url) window.location.href = d.url;
      else setError(d.error ?? 'Failed to create onboarding link');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function disconnectStripe() {
    if (!confirm('Disconnect Stripe account? Payments will stop working.')) return;
    setLoading(true);
    try {
      await fetch('/api/payment-provider/auth/stripe/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId }) });
      setStripeStatus(null); setStatusMsg('Stripe account disconnected.');
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function removeAllGHLAccounts() {
    if (!confirm('Remove ALL GHL connected accounts? This will disconnect every location and their linked Stripe accounts.')) return;
    setLoading(true); setError(''); setStatusMsg('');
    try {
      const r = await fetch('/api/payment-provider/admin/reset-ghl', { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Failed to remove GHL accounts'); return; }
      setStripeStatus(null);
      setStatusMsg(`Removed ${d.ghlRows} GHL connection(s) and ${d.stripeRows} Stripe connection(s).`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function removeThisGHLAccount() {
    if (!locationId) { setError('Enter a Location ID first.'); return; }
    if (!confirm(`Remove GHL account for location ${locationId}?`)) return;
    setLoading(true); setError(''); setStatusMsg('');
    try {
      const r = await fetch(`/api/payment-provider/admin/reset-ghl?locationId=${encodeURIComponent(locationId)}`, { method: 'DELETE' });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? 'Failed to remove GHL account'); return; }
      setStripeStatus(null);
      setStatusMsg(`Removed GHL connection for ${locationId}.`);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }
  async function registerProviderFor(locId) {
    if (!locId) return;
    setProviderLoading(true); setProviderResult(null);
    try {
      const r = await fetch('/api/payment-provider/admin/register-provider', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId: locId }) });
      const d = await r.json();
      setProviderResult(d);
      if (d.connect?.ok) setStatusMsg('Payment provider activated successfully in GHL!');
      else setStatusMsg('Provider registered — check Settings tab for details.');
    } catch (e) { setProviderResult({ error: e.message }); }
    finally { setProviderLoading(false); }
  }
  function registerProvider() { registerProviderFor(locationId); }
  async function registerStripeWebhook() {
    setWebhookLoading(true); setWebhookResult(null);
    try {
      const r = await fetch('/api/payment-provider/setup/register-stripe-webhook', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      const d = await r.json();
      setWebhookResult(d);
      if (d.success) setStatusMsg(`Stripe webhook registered (${d.mode} mode). Donor accounts will now be created on payment.`);
    } catch (e) { setWebhookResult({ success: false, error: e.message }); }
    finally { setWebhookLoading(false); }
  }
  async function createProduct() {
    if (!prodForm.name || !prodForm.price) { setProdError('Name and price are required.'); return; }
    setProdSaving(true); setProdError('');
    try {
      const r = await fetch('/api/payment-provider/products', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locationId, name: prodForm.name, description: prodForm.description || undefined, price: Math.round(parseFloat(prodForm.price) * 100), currency: prodForm.currency, ...(prodForm.type === 'recurring' ? { recurring: { interval: prodForm.interval } } : {}) }),
      });
      const d = await r.json();
      if (!r.ok) { setProdError(d.error ?? 'Failed to create product'); return; }
      setProdFormOpen(false); setProdForm({ name: '', description: '', price: '', currency: 'usd', type: 'one_time', interval: 'month' });
      fetchProducts(locationId, null);
    } catch (e) { setProdError(e.message); }
    finally { setProdSaving(false); }
  }
  async function saveEditProduct() {
    if (!editProduct?.name) { setProdError('Name is required.'); return; }
    setEditSaving(true); setProdError('');
    try {
      const r = await fetch(`/api/payment-provider/products/${editProduct.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId, name: editProduct.name, description: editProduct.description }) });
      const d = await r.json();
      if (!r.ok) { setProdError(d.error ?? 'Failed to update product'); return; }
      setEditProduct(null); fetchProducts(locationId, null);
    } catch (e) { setProdError(e.message); }
    finally { setEditSaving(false); }
  }
  async function archiveProduct(productId, name) {
    if (!confirm(`Archive "${name}"?`)) return;
    setProdError('');
    try {
      const r = await fetch(`/api/payment-provider/products/${productId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId }) });
      const d = await r.json();
      if (!r.ok) { setProdError(d.error ?? 'Failed to archive product'); return; }
      fetchProducts(locationId, null);
    } catch (e) { setProdError(e.message); }
  }
  async function syncFromGHL() {
    setSyncLoading(true); setSyncResult(null); setProdError('');
    try {
      const r = await fetch('/api/payment-provider/products/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locationId }) });
      const d = await r.json();
      if (!r.ok) { setProdError(d.error ?? 'Sync failed'); return; }
      setSyncResult(d);
      if (d.synced > 0) fetchProducts(locationId, null);
    } catch (e) { setProdError(e.message); }
    finally { setSyncLoading(false); }
  }

  const isFullyOnboarded = stripeStatus?.connected && stripeStatus?.chargesEnabled && stripeStatus?.detailsSubmitted;

  // ── Auto-activate provider when location + Stripe are both ready ──────────
  useEffect(() => {
    if (locationId && isFullyOnboarded && !providerLoading && !providerResult) {
      registerProviderFor(locationId);
    }
  }, [locationId, isFullyOnboarded]);

  const TABS = [
    { key: 'dashboard',    label: 'Dashboard',    icon: BarChart2  },
    { key: 'transactions', label: 'Transactions', icon: CreditCard },
    { key: 'products',     label: 'Products',     icon: Package    },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">GHL Payment Provider</h1>
        <p className="text-gray-500 text-sm mt-1">Connect your GHL location to Stripe to accept payments via ChangeWorks.</p>
      </div>

      {/* Alerts */}
      {statusMsg && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center gap-3 bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-xl text-sm font-medium">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />{statusMsg}
        </motion.div>
      )}
      {error && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-4 flex items-center gap-3 bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-xl text-sm font-medium">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
          <button onClick={() => setError('')} className="ml-auto text-red-500 hover:text-red-700"><XCircle className="w-4 h-4" /></button>
        </motion.div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${tab === key ? 'bg-white text-[#0E0061] shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ────────────────────────────────────────────────────── */}
      {tab === 'dashboard' && (
        <div className="space-y-6">

          {/* Status Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* GHL Location */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0E0061]/10 flex items-center justify-center">
                  <Wifi className="w-5 h-5 text-[#0E0061]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">GHL Location</p>
                  <p className="text-sm font-mono text-gray-600 mt-0.5">{locationId || '—'}</p>
                </div>
              </div>
              {locationId
                ? <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><Wifi className="w-3 h-3" />Connected</span>
                : <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full"><WifiOff className="w-3 h-3" />Not connected</span>}
            </div>

            {/* Stripe Account */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0E0061]/10 flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-[#0E0061]" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Stripe Account</p>
                  <p className="text-sm font-mono text-gray-600 mt-0.5">{stripeStatus?.stripeAccountId || '—'}</p>
                </div>
              </div>
              {loading ? <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                : isFullyOnboarded ? <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle className="w-3 h-3" />Active</span>
                : stripeStatus?.connected ? <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full"><AlertCircle className="w-3 h-3" />Incomplete</span>
                : <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full"><WifiOff className="w-3 h-3" />Not connected</span>}
            </div>
          </div>

          {/* Stripe Account Details — shown when connected */}
          {stripeStatus?.connected && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 flex flex-wrap gap-6">
                <div><p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Name</p><p className="font-semibold text-sm">{stripeStatus.displayName || '—'}</p></div>
                <div><p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Email</p><p className="text-sm">{stripeStatus.email || '—'}</p></div>
                <div><p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Account ID</p><p className="text-xs font-mono text-gray-500">{stripeStatus.stripeAccountId}</p></div>
                <div><p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">Country</p><p className="text-sm">{stripeStatus.country?.toUpperCase() || '—'}</p></div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Available Balance', value: currency(stripeStatus.availableBalance, stripeStatus.balanceCurrency) },
                  { label: 'Pending Balance',   value: currency(stripeStatus.pendingBalance,   stripeStatus.balanceCurrency) },
                  { label: 'Succeeded',         value: `${stripeStatus.succeededTxCount ?? 0} payments${stripeStatus.hasMore ? '+' : ''}` },
                  { label: 'Status', value: (
                    <div className="flex gap-1 flex-wrap">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${stripeStatus.chargesEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{stripeStatus.chargesEnabled ? 'Charges ✓' : 'Charges ✗'}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${stripeStatus.payoutsEnabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{stripeStatus.payoutsEnabled ? 'Payouts ✓' : 'Payouts ✗'}</span>
                    </div>
                  )},
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-400 mb-1">{label}</p>
                    <div className="font-bold text-gray-900 text-sm">{value}</div>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 flex-wrap">
                {!isFullyOnboarded && (
                  <button onClick={startOnboarding} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 bg-[#0E0061] text-white text-sm font-semibold rounded-xl hover:bg-[#0E0061]/90 disabled:opacity-50 transition-colors">
                    <ExternalLink className="w-4 h-4" />Complete Stripe Onboarding
                  </button>
                )}
                <button onClick={disconnectStripe} disabled={loading} className="flex items-center gap-2 px-4 py-2.5 bg-red-50 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-100 disabled:opacity-50 transition-colors">
                  <Unplug className="w-4 h-4" />Disconnect Stripe
                </button>
              </div>
            </div>
          )}

          {/* Connect — shown when not connected */}
          {!stripeStatus?.connected && !loading && !autoConnecting && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-3">
              {orgStripeAccountId && (
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <CreditCard className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Stripe Account (Organization)</p>
                    <p className="text-xs font-mono text-gray-600 mt-0.5">{orgStripeAccountId}</p>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 mb-1">Connect via GHL Marketplace</p>
                  <p className="text-sm text-gray-500">Install the GHL app to automatically link your Stripe account.</p>
                </div>
                <button onClick={connectGHL} className="flex items-center gap-2 px-4 py-2.5 bg-[#0E0061] text-white text-sm font-semibold rounded-xl hover:bg-[#0E0061]/90 transition-colors whitespace-nowrap ml-4">
                  <ExternalLink className="w-4 h-4" />Connect GHL
                </button>
              </div>
              <div className="flex gap-3 pt-2 border-t border-gray-100">
                <button onClick={removeThisGHLAccount} disabled={loading || !locationId} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
                  <Unplug className="w-3.5 h-3.5" />Remove This Location
                </button>
                <button onClick={removeAllGHLAccounts} disabled={loading} className="flex items-center gap-2 px-3 py-2 bg-red-50 text-red-600 text-xs font-semibold rounded-lg hover:bg-red-100 disabled:opacity-50 transition-colors">
                  <XCircle className="w-3.5 h-3.5" />Remove All GHL Accounts
                </button>
              </div>
            </div>
          )}

          {/* Provider activation status */}
          {providerLoading && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center gap-3 text-blue-700 text-sm font-medium">
              <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />Activating payment provider in GHL…
            </div>
          )}

          {/* ── Provider Debug Panel ─────────────────────────────────────────── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header row */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <Bug className="w-4 h-4 text-gray-400" />
                <span className="font-semibold text-gray-900 text-sm">Payment Provider Registration</span>
                {providerLoading ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full"><Loader2 className="w-3 h-3 animate-spin" />Checking…</span>
                ) : providerResult?.connect?.ok ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle className="w-3 h-3" />Registered</span>
                ) : providerResult?.error ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full"><XCircle className="w-3 h-3" />GHL Not Connected</span>
                ) : providerResult ? (
                  <span className="flex items-center gap-1 text-xs font-semibold text-yellow-700 bg-yellow-100 px-2.5 py-1 rounded-full"><AlertCircle className="w-3 h-3" />Partial / Failed</span>
                ) : (
                  <span className="flex items-center gap-1 text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">Not checked</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => registerProviderFor(locationId)}
                  disabled={providerLoading || !locationId}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0E0061] text-white text-xs font-semibold rounded-lg hover:bg-[#0E0061]/90 disabled:opacity-50 transition-colors"
                >
                  <RefreshCw className={`w-3 h-3 ${providerLoading ? 'animate-spin' : ''}`} />Re-register
                </button>
                <button
                  onClick={() => setShowDebug(v => !v)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg hover:bg-gray-200 transition-colors"
                >
                  {showDebug ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showDebug ? 'Hide' : 'Details'}
                </button>
              </div>
            </div>

            {/* Summary row — always visible */}
            {providerResult && (
              <div className="grid grid-cols-2 md:grid-cols-5 divide-x divide-gray-100 border-b border-gray-100">
                {[
                  { label: 'GHL Token',       value: providerResult.token,                         ok: providerResult.token && !providerResult.token.startsWith('ERROR') },
                  { label: 'Create Provider', value: providerResult.createProvider?.ok ? 'OK' : (providerResult.createProvider?.status ?? (providerResult.createProvider ? 'Failed' : '—')),   ok: providerResult.createProvider?.ok },
                  { label: 'Alt Provider',    value: providerResult.createProviderAlt?.ok ? 'OK' : (providerResult.createProviderAlt?.status ?? '—'),  ok: providerResult.createProviderAlt?.ok },
                  { label: 'Env Check',       value: providerResult.envCheck ? (providerResult.envCheck.hasStripeAccount ? 'Stripe ✓' : 'No Stripe') : '—', ok: providerResult.envCheck?.hasStripeAccount },
                  { label: 'Connect',         value: providerResult.connect?.ok ? 'OK' : (providerResult.connect?.status ?? (providerResult.connect ? 'Failed' : '—')),  ok: providerResult.connect?.ok },
                ].map(({ label, value, ok }) => (
                  <div key={label} className="px-4 py-3">
                    <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-1">{label}</p>
                    <p className={`text-xs font-mono font-bold ${ok === true ? 'text-green-600' : ok === false ? 'text-red-500' : 'text-gray-400'}`}>{value ?? '—'}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Expanded detail view */}
            {showDebug && (
              <div className="p-5 space-y-4">
                {!providerResult ? (
                  <p className="text-sm text-gray-400">No registration data yet. Click Re-register to check.</p>
                ) : (
                  <>
                    {/* GHL Token */}
                    <DebugRow label="GHL Token" ok={providerResult.token && !providerResult.token.startsWith('ERROR')}>
                      <code className="text-xs">{providerResult.token ?? '—'}</code>
                      {providerResult.error && <p className="text-red-500 text-xs mt-1">{providerResult.error}</p>}
                    </DebugRow>

                    {/* Env Check */}
                    {providerResult.envCheck && (
                      <DebugRow label="Environment Variables" ok={providerResult.envCheck.hasStripeAccount && providerResult.envCheck.hasGhlClientSecret}>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                          {[
                            { k: 'GHL_APP_CLIENT_SECRET', v: providerResult.envCheck.hasGhlClientSecret },
                            { k: 'STRIPE_PUBLISHABLE_KEY_LIVE',    v: providerResult.envCheck.hasLivePubKey },
                            { k: 'STRIPE_PUBLISHABLE_KEY_SANDBOX', v: providerResult.envCheck.hasTestPubKey },
                            { k: 'Stripe Account in DB',           v: providerResult.envCheck.hasStripeAccount },
                            { k: 'Stripe Account ID',              v: providerResult.envCheck.stripeAccountId ?? 'none' },
                            { k: 'Stored PK Prefix',               v: providerResult.envCheck.storedPkPrefix ?? 'none' },
                          ].map(({ k, v }) => (
                            <div key={k} className="flex items-center gap-1.5">
                              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${v === true ? 'bg-green-500' : v === false ? 'bg-red-400' : 'bg-gray-300'}`} />
                              <span className="text-xs text-gray-500 font-mono">{k}: <span className={`font-bold ${v === true ? 'text-green-600' : v === false ? 'text-red-500' : 'text-gray-700'}`}>{v === true ? 'set' : v === false ? 'missing' : v}</span></span>
                            </div>
                          ))}
                        </div>
                      </DebugRow>
                    )}

                    {/* Create Provider */}
                    {providerResult.createProvider && (
                      <DebugRow label="POST /payments/custom-provider/provider" ok={providerResult.createProvider.ok}>
                        <pre className="text-xs mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(providerResult.createProvider, null, 2)}</pre>
                      </DebugRow>
                    )}

                    {/* Alt Provider */}
                    {providerResult.createProviderAlt && (
                      <DebugRow label="POST /payments/integrations/provider/whitelabel (fallback)" ok={providerResult.createProviderAlt.ok}>
                        <pre className="text-xs mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(providerResult.createProviderAlt, null, 2)}</pre>
                      </DebugRow>
                    )}

                    {/* Connect */}
                    {providerResult.connect && (
                      <DebugRow label="POST /payments/custom-provider/connect" ok={providerResult.connect.ok}>
                        <pre className="text-xs mt-1 overflow-x-auto whitespace-pre-wrap">{JSON.stringify(providerResult.connect, null, 2)}</pre>
                      </DebugRow>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        {/* ── Stripe Webhook Registration ────────────────────────────────────── */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <Zap className="w-4 h-4 text-gray-400" />
              <div>
                <span className="font-semibold text-gray-900 text-sm">Stripe Webhook (Donor Auto-Create)</span>
                <p className="text-xs text-gray-400 mt-0.5">Registers the live Stripe Connect webhook so new donors get accounts + welcome emails on first payment.</p>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              {webhookResult && (
                webhookResult.success
                  ? <span className="flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-100 px-2.5 py-1 rounded-full"><CheckCircle className="w-3 h-3" />Registered</span>
                  : <span className="flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-100 px-2.5 py-1 rounded-full"><XCircle className="w-3 h-3" />Failed</span>
              )}
              <button
                onClick={registerStripeWebhook}
                disabled={webhookLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0E0061] text-white text-xs font-semibold rounded-lg hover:bg-[#0E0061]/90 disabled:opacity-50 transition-colors"
              >
                <Zap className={`w-3 h-3 ${webhookLoading ? 'animate-pulse' : ''}`} />
                {webhookLoading ? 'Registering…' : 'Register Webhook'}
              </button>
            </div>
          </div>
          {webhookResult && (
            <div className="px-5 pb-4">
              <pre className="text-xs bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap text-gray-600">
                {JSON.stringify(webhookResult, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
      )}
      {/* ── TRANSACTIONS TAB ─────────────────────────────────────────────────── */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex justify-between items-center p-5 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Payment History</h2>
            <button onClick={() => { setTxCursor(null); fetchTransactions(locationId, null); }} disabled={txLoading || !locationId} className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${txLoading ? 'animate-spin' : ''}`} />Refresh
            </button>
          </div>
          {!locationId && <p className="p-6 text-sm text-gray-500">Enter a Location ID on the Dashboard tab first.</p>}
          {txLoading && transactions.length === 0 && <p className="p-6 text-sm text-gray-500">Loading transactions…</p>}
          {!txLoading && !transactions.length && locationId && <p className="p-6 text-sm text-gray-500">No transactions found.</p>}
          {transactions.length > 0 && (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-100">
                    <tr>
                      {['Date', 'Customer', 'Payment Intent', 'Amount', 'Status'].map(h => (
                        <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx) => (
                      <tr key={tx.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3.5 text-gray-500 whitespace-nowrap">{new Date(tx.created * 1000).toLocaleDateString()}</td>
                        <td className="px-5 py-3.5">
                          {tx.customerName || tx.customerEmail ? (
                            <div>
                              {tx.customerName  && <p className="font-medium text-gray-900">{tx.customerName}</p>}
                              {tx.customerEmail && <p className="text-xs text-gray-400">{tx.customerEmail}</p>}
                            </div>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3.5"><span className="font-mono text-xs text-gray-400">{tx.id.slice(0, 20)}…</span></td>
                        <td className="px-5 py-3.5 text-right font-semibold text-gray-900">{currency(tx.amount, tx.currency)}</td>
                        <td className="px-5 py-3.5"><Badge status={tx.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {txHasMore && (
                <div className="p-4 text-center border-t border-gray-100">
                  <button onClick={() => fetchTransactions(locationId, txCursor)} disabled={txLoading} className="px-4 py-2 text-sm text-[#0E0061] font-semibold hover:underline disabled:opacity-50">
                    {txLoading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── PRODUCTS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'products' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 justify-between items-center">
            <div className="flex gap-2">
              <button onClick={() => setProdFormOpen(v => !v)} disabled={!locationId} className="flex items-center gap-2 px-4 py-2.5 bg-[#0E0061] text-white text-sm font-semibold rounded-xl hover:bg-[#0E0061]/90 disabled:opacity-50 transition-colors">
                <Package className="w-4 h-4" />{prodFormOpen ? 'Cancel' : 'New Product'}
              </button>
              <button onClick={syncFromGHL} disabled={!locationId || syncLoading} className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 disabled:opacity-50 transition-colors">
                <RefreshCw className={`w-4 h-4 ${syncLoading ? 'animate-spin' : ''}`} />{syncLoading ? 'Syncing…' : 'Sync from GHL'}
              </button>
            </div>
          </div>

          {prodError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm"><AlertCircle className="w-4 h-4" />{prodError}</div>}
          {syncResult && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">Synced {syncResult.synced} products, skipped {syncResult.skipped}{syncResult.errors?.length ? `, ${syncResult.errors.length} errors` : ''}.</div>}

          {prodFormOpen && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">New Product</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Name *</label><input type="text" value={prodForm.name} onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0E0061]" /></div>
                <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Price (USD) *</label><input type="number" step="0.01" value={prodForm.price} onChange={e => setProdForm(f => ({ ...f, price: e.target.value }))} placeholder="9.99" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0E0061]" /></div>
                <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Description</label><input type="text" value={prodForm.description} onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0E0061]" /></div>
                <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Type</label>
                  <select value={prodForm.type} onChange={e => setProdForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0E0061]">
                    <option value="one_time">One-time</option>
                    <option value="recurring">Recurring</option>
                  </select>
                </div>
                {prodForm.type === 'recurring' && (
                  <div><label className="text-xs font-semibold text-gray-500 mb-1 block">Interval</label>
                    <select value={prodForm.interval} onChange={e => setProdForm(f => ({ ...f, interval: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0E0061]">
                      <option value="month">Monthly</option>
                      <option value="year">Yearly</option>
                      <option value="week">Weekly</option>
                    </select>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={createProduct} disabled={prodSaving} className="flex items-center gap-2 px-4 py-2.5 bg-[#0E0061] text-white text-sm font-semibold rounded-xl hover:bg-[#0E0061]/90 disabled:opacity-50 transition-colors">
                  {prodSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}Save Product
                </button>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {prodLoading && !products.length && <p className="p-6 text-sm text-gray-500">Loading products…</p>}
            {!prodLoading && !products.length && <p className="p-6 text-sm text-gray-500">No products found. Create one or sync from GHL.</p>}
            {products.length > 0 && (
              <div className="divide-y divide-gray-50">
                {products.map((p) => {
                  const isEditing = editProduct?.id === p.id;
                  const price = p.default_price;
                  const priceLabel = price ? currency(price.unit_amount, price.currency) + (price.recurring ? `/${price.recurring.interval}` : '') : '—';
                  return (
                    <div key={p.id} className="p-5">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input type="text" value={editProduct.name} onChange={e => setEditProduct(ep => ({ ...ep, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0E0061]" />
                          <input type="text" value={editProduct.description ?? ''} onChange={e => setEditProduct(ep => ({ ...ep, description: e.target.value }))} placeholder="Description" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[#0E0061]" />
                          <div className="flex gap-2">
                            <button onClick={saveEditProduct} disabled={editSaving} className="px-3 py-1.5 bg-[#0E0061] text-white text-xs font-semibold rounded-lg disabled:opacity-50">{editSaving ? 'Saving…' : 'Save'}</button>
                            <button onClick={() => setEditProduct(null)} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-gray-900">{p.name}</p>
                            {p.description && <p className="text-xs text-gray-400 mt-0.5">{p.description}</p>}
                            <p className="text-sm font-medium text-[#0E0061] mt-1">{priceLabel}</p>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => setEditProduct({ id: p.id, name: p.name, description: p.description ?? '' })} className="px-3 py-1.5 text-xs font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">Edit</button>
                            <button onClick={() => archiveProduct(p.id, p.name)} className="px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Archive</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {prodHasMore && (
                  <div className="p-4 text-center">
                    <button onClick={() => fetchProducts(locationId, prodCursor)} disabled={prodLoading} className="px-4 py-2 text-sm text-[#0E0061] font-semibold hover:underline disabled:opacity-50">
                      {prodLoading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── SETTINGS TAB ─────────────────────────────────────────────────────── */}
    </div>
  );
}
