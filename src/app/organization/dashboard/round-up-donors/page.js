'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Banknote,
  Users,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle,
  AlertCircle,
  Building2,
  CreditCard,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Link2,
  Trash2,
  X,
} from 'lucide-react';

const formatCurrency = (amount, iso_currency_code = 'USD') =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: iso_currency_code || 'USD' }).format(amount || 0);

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export default function RoundUpDonorsPage() {
  const [connections, setConnections] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedDonor, setExpandedDonor] = useState(null);
  const [search, setSearch] = useState('');
  const [cleaning, setCleaning] = useState(false);
  const [disconnecting, setDisconnecting] = useState(new Set());
  const [confirmDisconnect, setConfirmDisconnect] = useState(null); // { donorId, donorName }

  const fetchConnections = async () => {
    try {
      setLoading(true);
      setError('');

      const token = sessionStorage.getItem('orgToken');
      if (!token) { window.location.href = '/organization/login'; return; }

      const response = await fetch('/api/organization/plaid-connections', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to fetch Round-Up donors');

      setConnections(data.connections || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConnections(); }, []); // eslint-disable-line

  const filteredConnections = connections.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.donor?.name?.toLowerCase().includes(q) ||
      c.donor?.email?.toLowerCase().includes(q) ||
      c.institution_name?.toLowerCase().includes(q)
    );
  });

  const toggleDonor = (id) => setExpandedDonor((prev) => (prev === id ? null : id));

  const hasMockConnections = connections.some((c) => c.status === 'ERROR' || c.institution_name === 'Mock Bank');

  const cleanupMockConnections = async () => {
    if (!confirm('This will permanently delete all mock/invalid bank connections. Affected donors will need to reconnect. Continue?')) return;
    try {
      setCleaning(true);
      const token = sessionStorage.getItem('orgToken');
      const res = await fetch('/api/plaid/cleanup-mock', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      alert(data.message);
      fetchConnections();
    } catch (err) {
      alert('Cleanup failed: ' + err.message);
    } finally {
      setCleaning(false);
    }
  };

  const disconnectDonor = async (donorId) => {
    const token = sessionStorage.getItem('orgToken');
    setDisconnecting((prev) => new Set(prev).add(donorId));
    setConfirmDisconnect(null);
    try {
      const res = await fetch('/api/plaid/disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ donor_id: donorId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Disconnect failed');
      fetchConnections();
    } catch (err) {
      alert('Failed to remove connection: ' + err.message);
    } finally {
      setDisconnecting((prev) => {
        const next = new Set(prev);
        next.delete(donorId);
        return next;
      });
    }
  };

  const statCards = [
    { label: 'Round-Up Donors', value: summary?.total_donors ?? '—', icon: Users, color: 'blue' },
    { label: 'Funding Source Ready', value: summary?.funding_ready ?? '—', icon: ShieldCheck, color: 'green' },
    { label: 'Institutions', value: summary?.institutions ?? '—', icon: Building2, color: 'purple' },
  ];

  const colorMap = {
    blue:   { bg: 'bg-blue-50',   icon: 'text-blue-600',   border: 'border-blue-200' },
    green:  { bg: 'bg-green-50',  icon: 'text-green-600',  border: 'border-green-200' },
    purple: { bg: 'bg-purple-50', icon: 'text-purple-600', border: 'border-purple-200' },
  };

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Round-Up Donors</h1>
          <p className="text-gray-500 mt-1">Donors who connected their bank accounts via Plaid for round-up donations</p>
        </div>
        <div className="flex items-center gap-2">
          {hasMockConnections && (
            <button
              onClick={cleanupMockConnections}
              disabled={cleaning}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {cleaning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
              Remove Mock Connections
            </button>
          )}
          <button
            onClick={fetchConnections}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-[#0E0061] text-white rounded-xl hover:bg-[#1a0099] transition-colors disabled:opacity-50 text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {statCards.map((card) => {
          const colors = colorMap[card.color];
          return (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className={`bg-white rounded-2xl border ${colors.border} shadow-sm p-5`}
            >
              <div className={`inline-flex p-2 rounded-xl ${colors.bg} mb-3`}>
                <card.icon className={`w-5 h-5 ${colors.icon}`} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{card.value}</div>
              <div className="text-xs text-gray-500 mt-1">{card.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Search by donor name, email, or institution..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0E0061]/30 bg-white"
        />
      </div>

      {/* Connections List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400">
          <Loader2 className="w-8 h-8 animate-spin mb-3" />
          <span className="text-sm">Loading round-up donors...</span>
        </div>
      ) : filteredConnections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
          <Banknote className="w-10 h-10 mb-3 text-gray-300" />
          <p className="text-sm font-medium">No round-up donors found</p>
          <p className="text-xs mt-1">{search ? 'Try a different search term' : 'No donors have connected their bank accounts yet'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredConnections.map((conn, idx) => (
            <motion.div
              key={conn.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              {/* Donor Row */}
              <div
                className="flex items-center justify-between p-5 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => toggleDonor(conn.id)}
              >
                <div className="flex items-center gap-4">
                  {/* Institution Logo */}
                  {conn.institution_logo && (
                    <img
                      src={`data:image/png;base64,${conn.institution_logo}`}
                      alt={conn.institution_name || 'Bank'}
                      className="w-8 h-8 rounded-lg object-contain border border-gray-100 bg-white p-0.5 flex-shrink-0"
                    />
                  )}

                  <div>
                    <div className="font-semibold text-gray-900 text-sm">{conn.donor?.name || 'Unknown Donor'}</div>
                    <div className="text-xs text-gray-500">{conn.donor?.email}</div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {/* Institution */}
                  <div className="hidden sm:block text-right">
                    <div className="text-xs text-gray-500 font-medium">Institution</div>
                    <div className="text-sm text-gray-800 font-semibold">{conn.institution_name || '—'}</div>
                  </div>

                  {/* Funding Source */}
                  <div className="hidden md:flex items-center gap-1.5">
                    {conn.funding_source?.ready ? (
                      <>
                        <ShieldCheck className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-semibold text-green-600">ACH Ready</span>
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-amber-600">ACH Pending</span>
                      </>
                    )}
                  </div>

                  {/* Connection Status */}
                  <div className="hidden md:flex items-center gap-1.5">
                    {conn.status === 'ACTIVE' ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-xs font-semibold text-green-600">Active</span>
                      </>
                    ) : conn.status === 'LOGIN_REQUIRED' ? (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-400" />
                        <span className="text-xs font-semibold text-amber-600">Re-login Required</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-semibold text-red-500">{conn.status}</span>
                      </>
                    )}
                  </div>

                  {/* Connected date */}
                  <div className="hidden lg:block text-right">
                    <div className="text-xs text-gray-500 font-medium">Connected</div>
                    <div className="text-xs text-gray-700">{formatDate(conn.connected_at)}</div>
                  </div>

                  {expandedDonor === conn.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Detail */}
              <AnimatePresence>
                {expandedDonor === conn.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-gray-100 px-5 py-4 space-y-5 bg-gray-50">

                      {/* Funding Source */}
                      <div>
                        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                          <Link2 className="w-3.5 h-3.5" />
                          Funding Source (ACH)
                        </h3>
                        {conn.funding_source?.ready ? (
                          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {conn.funding_source.ach_details?.map((ach) => (
                              <div key={ach.account_id} className="bg-white rounded-xl border border-green-200 p-3">
                                <div className="flex items-center gap-2 mb-1">
                                  <ShieldCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                                  <span className="text-sm font-semibold text-gray-800">ACH Verified</span>
                                </div>
                                <div className="text-xs text-gray-500">Account ••••{ach.account_last4}</div>
                                <div className="text-xs text-gray-500 mt-0.5">Routing: {ach.routing}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                            <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-semibold text-amber-800">Funding source not yet verified</p>
                              <p className="text-xs text-amber-600 mt-0.5">
                                {conn.funding_source?.error || 'ACH routing numbers are not available for this connection'}
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Remove Connection */}
                      <div className="flex justify-end pt-1">
                        <button
                          onClick={() => setConfirmDisconnect({ donorId: conn.donor?.id, donorName: conn.donor?.name || conn.donor?.email || 'this donor' })}
                          disabled={disconnecting.has(conn.donor?.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {disconnecting.has(conn.donor?.id) ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                          {disconnecting.has(conn.donor?.id) ? 'Removing...' : 'Remove Connection'}
                        </button>
                      </div>

                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {/* Disconnect Confirmation Modal */}
      <AnimatePresence>
        {confirmDisconnect && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setConfirmDisconnect(null); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <Trash2 className="w-5 h-5 text-red-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900">Remove Bank Connection</h3>
                </div>
                <button onClick={() => setConfirmDisconnect(null)} className="text-gray-400 hover:text-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-600 text-sm mb-6">
                Are you sure you want to remove the bank connection for <strong>{confirmDisconnect.donorName}</strong>? They will need to reconnect their bank account to continue round-up donations.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDisconnect(null)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Keep Connection
                </button>
                <button
                  onClick={() => disconnectDonor(confirmDisconnect.donorId)}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700 transition-colors"
                >
                  Yes, Remove
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
