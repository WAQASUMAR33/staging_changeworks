'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Banknote,
  CheckCircle,
  AlertCircle,
  Loader2,
  Building2,
  TrendingUp,
  Calendar,
  CreditCard,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Zap,
  X,
} from 'lucide-react';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount || 0);

const formatDate = (dateStr) => {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
};

// Round-up calculation: $4.30 → $0.70
function calcRoundUp(amount) {
  if (!amount || amount <= 0) return 0;
  const cents = Math.round(amount * 100) % 100;
  return cents === 0 ? 0 : parseFloat(((100 - cents) / 100).toFixed(2));
}

// Default date range: last 30 days
function getDefaultDates() {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - 30);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function DonorRoundUpTransactionsPage() {
  const defaults = getDefaultDates();
  const [startDate, setStartDate] = useState(defaults.start);
  const [endDate, setEndDate] = useState(defaults.end);

  const [connections, setConnections] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  // Charge state
  const [charging, setCharging] = useState(false);
  const [chargeResult, setChargeResult] = useState(null); // { success, message, amount }
  const [chargeError, setChargeError] = useState('');

  const loadTransactions = async () => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      if (!token) { window.location.href = '/donor/login'; return; }

      const params = new URLSearchParams({ start_date: startDate, end_date: endDate });
      const res = await fetch(`/api/plaid/donor-transactions?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Failed to load transactions');
        return;
      }

      // Attach raw accounts JSON for charge-roundup account_id lookup
      const conns = (data.connections || []).map(c => ({
        ...c,
        accounts_raw: JSON.stringify(c.accounts || []),
      }));
      setConnections(conns);
      setSummary(data.summary || null);
      setLoaded(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const chargeRoundUp = async (conn) => {
    try {
      setCharging(true);
      setChargeError('');
      setChargeResult(null);

      const token = localStorage.getItem('token');
      if (!token) return;

      // Use the first checking/savings account from this connection
      let accounts = [];
      try { accounts = JSON.parse(conn.accounts_raw || '[]'); } catch { /**/ }
      // Prefer checking, then savings, then first account
      const account =
        accounts.find(a => a.subtype === 'checking') ||
        accounts.find(a => a.subtype === 'savings') ||
        accounts[0];

      if (!account?.account_id) {
        setChargeError('No account found for this connection.');
        return;
      }

      const res = await fetch('/api/plaid/charge-roundup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          account_id: account.account_id,
          plaid_connection_id: conn.id,
          start_date: startDate,
          end_date: endDate,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setChargeError(data.error || 'Charge failed');
        return;
      }

      setChargeResult({
        success: true,
        message: data.message,
        amount: data.amount_dollars,
        charge_id: data.charge_id,
      });
    } catch (err) {
      setChargeError(err.message);
    } finally {
      setCharging(false);
    }
  };

  // Aggregate all transactions across connections
  const allTransactions = connections.flatMap(conn =>
    (conn.transactions || []).map(t => ({ ...t, _institution: conn.institution_name }))
  );
  const purchases = allTransactions.filter(t => t.amount > 0);
  const totalRoundUp = purchases.reduce((sum, t) => sum + calcRoundUp(t.amount), 0);

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Round-Up Transactions</h1>
        <p className="text-gray-500 mt-1">Your bank transactions and estimated round-up amounts</p>
      </div>

      {error && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 text-red-700 rounded-2xl px-4 py-3 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Date range + fetch button */}
      <div className="flex flex-wrap items-end gap-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">From</label>
          <input
            type="date"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-500">To</label>
          <input
            type="date"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500"
          />
        </div>
        <button
          onClick={loadTransactions}
          disabled={loading}
          className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors duration-200"
        >
          {loading
            ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading...</>
            : <><RefreshCw className="w-4 h-4" /> {loaded ? 'Refresh' : 'Fetch Transactions'}</>
          }
        </button>
      </div>

      {/* Placeholder before first load */}
      {!loaded && !loading && (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400">
          <Banknote className="w-12 h-12 mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Select a date range and click &quot;Fetch Transactions&quot;</p>
        </div>
      )}

      {/* Results */}
      {loaded && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl border border-emerald-200 shadow-sm p-5">
              <div className="inline-flex p-2 rounded-xl bg-emerald-50 mb-3">
                <TrendingUp className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{formatCurrency(totalRoundUp)}</div>
              <div className="text-xs text-gray-500 mt-1">Total Round-Up</div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl border border-blue-200 shadow-sm p-5">
              <div className="inline-flex p-2 rounded-xl bg-blue-50 mb-3">
                <Banknote className="w-5 h-5 text-blue-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{purchases.length}</div>
              <div className="text-xs text-gray-500 mt-1">Transactions</div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl border border-purple-200 shadow-sm p-5">
              <div className="inline-flex p-2 rounded-xl bg-purple-50 mb-3">
                <Building2 className="w-5 h-5 text-purple-600" />
              </div>
              <div className="text-2xl font-bold text-gray-900">{connections.length}</div>
              <div className="text-xs text-gray-500 mt-1">Bank Accounts</div>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="inline-flex p-2 rounded-xl bg-gray-50 mb-3">
                <Calendar className="w-5 h-5 text-gray-600" />
              </div>
              <div className="text-sm font-bold text-gray-900">{formatDate(startDate)}</div>
              <div className="text-xs text-gray-500 mt-1">→ {formatDate(endDate)}</div>
            </motion.div>
          </div>

          {/* No connections */}
          {connections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400">
              <Building2 className="w-10 h-10 mb-3 text-gray-300" />
              <p className="text-sm font-medium">No bank accounts connected</p>
              <p className="text-xs mt-1">Connect your bank from the dashboard to start round-ups</p>
            </div>
          )}

          {/* Charge result banner */}
          {chargeResult && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <p className="font-semibold text-sm">Charge Successful!</p>
                  <p className="text-xs text-emerald-700">
                    {formatCurrency(chargeResult.amount)} donated · {chargeResult.message} · ID: {chargeResult.charge_id}
                  </p>
                </div>
              </div>
              <button onClick={() => setChargeResult(null)} className="text-emerald-500 hover:text-emerald-700">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {chargeError && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="flex items-center justify-between gap-3 bg-red-50 border border-red-200 text-red-800 rounded-2xl px-5 py-4">
              <div className="flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium">{chargeError}</p>
                  {chargeError.includes('No funding card') && (
                    <a
                      href="/donor/dashboard"
                      className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-blue-600 hover:underline"
                    >
                      <CreditCard className="w-3 h-3" /> Go to Dashboard to add a card
                    </a>
                  )}
                </div>
              </div>
              <button onClick={() => setChargeError('')} className="text-red-400 hover:text-red-600 flex-shrink-0">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {/* Transactions per connection */}
          {connections.map((conn, ci) => (
            <div key={conn.id}>
              {/* Bank header */}
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Building2 className="w-4 h-4 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{conn.institution_name || 'Bank Account'}</p>
                  <p className="text-xs text-gray-400">{conn.accounts?.length ?? 0} account(s)</p>
                </div>
                <span className={`ml-auto inline-flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-full ${
                  conn.status === 'ACTIVE' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {conn.status === 'ACTIVE'
                    ? <><CheckCircle className="w-3 h-3" /> Active</>
                    : <><AlertCircle className="w-3 h-3" /> {conn.status}</>}
                </span>
                {conn.status === 'ACTIVE' && (
                  <button
                    onClick={() => chargeRoundUp(conn)}
                    disabled={charging}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-xl transition-colors duration-200"
                  >
                    {charging
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Charging...</>
                      : <><Zap className="w-3 h-3" /> Charge Round-Up</>}
                  </button>
                )}
              </div>

              {conn.transactions_error && (
                <div className="mb-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {conn.transactions_error}
                </div>
              )}

              {conn.transactions?.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 bg-white rounded-2xl border border-gray-100 shadow-sm text-gray-400 mb-4">
                  <CreditCard className="w-8 h-8 mb-2 text-gray-300" />
                  <p className="text-sm">No transactions in this period</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-6">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 font-semibold border-b border-gray-100">
                          <th className="text-left px-5 py-3">Date</th>
                          <th className="text-left px-5 py-3">Description</th>
                          <th className="text-left px-5 py-3 hidden md:table-cell">Category</th>
                          <th className="text-right px-5 py-3">Amount</th>
                          <th className="text-right px-5 py-3 text-emerald-600">Round-Up</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {conn.transactions.map((t) => {
                          const roundUp = calcRoundUp(t.amount);
                          const isDebit = t.amount > 0;
                          return (
                            <tr key={t.transaction_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-5 py-3 text-gray-500 whitespace-nowrap text-xs">
                                {formatDate(t.date)}
                              </td>
                              <td className="px-5 py-3 max-w-[200px]">
                                <p className="text-gray-800 font-medium truncate">{t.merchant_name || t.name}</p>
                                {t.merchant_name && t.name !== t.merchant_name && (
                                  <p className="text-xs text-gray-400 truncate">{t.name}</p>
                                )}
                              </td>
                              <td className="px-5 py-3 hidden md:table-cell">
                                <span className="text-xs text-gray-400">
                                  {t.personal_finance_category?.primary || t.category?.[0] || '—'}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                <span className={`font-semibold flex items-center justify-end gap-1 ${isDebit ? 'text-red-600' : 'text-emerald-600'}`}>
                                  {isDebit
                                    ? <ArrowUpRight className="w-3 h-3" />
                                    : <ArrowDownLeft className="w-3 h-3" />}
                                  {formatCurrency(Math.abs(t.amount))}
                                </span>
                              </td>
                              <td className="px-5 py-3 text-right whitespace-nowrap">
                                {roundUp > 0
                                  ? <span className="font-bold text-emerald-600">{formatCurrency(roundUp)}</span>
                                  : <span className="text-gray-300">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-emerald-50 border-t border-emerald-100">
                          <td colSpan={3} className="px-5 py-3 text-xs font-semibold text-emerald-700 hidden md:table-cell">
                            Total Round-Up for {conn.institution_name}
                          </td>
                          <td colSpan={1} className="px-5 py-3 text-xs font-semibold text-emerald-700 md:hidden">
                            Total Round-Up
                          </td>
                          <td className="px-5 py-3 text-right font-bold text-emerald-700 whitespace-nowrap" colSpan={2}>
                            {formatCurrency(
                              (conn.transactions || [])
                                .filter(t => t.amount > 0)
                                .reduce((sum, t) => sum + calcRoundUp(t.amount), 0)
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
