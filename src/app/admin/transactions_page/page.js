'use client';

import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  Button,
  CircularProgress,
  TablePagination,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Package } from 'lucide-react';

// Helper function to format dates consistently
const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

// Helper function to format currency
const formatCurrency = (amount, currency) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
};

// Helper functions for transaction type colors and labels
const getTransactionTypeColor = (type) => {
  switch (type?.toLowerCase()) {
    case 'one_time':
    case 'one-time':
      return 'text-blue-600 bg-blue-100';
    case 'subscription':
      return 'text-purple-600 bg-purple-100';
    case 'recurring':
      return 'text-indigo-600 bg-indigo-100';
    case 'donation':
      return 'text-green-600 bg-green-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
};

const getTransactionTypeLabel = (type) => {
  switch (type?.toLowerCase()) {
    case 'one_time':
    case 'one-time':
      return 'One-time';
    case 'subscription':
      return 'Subscription';
    case 'recurring':
      return 'Recurring';
    case 'donation':
      return 'Donation';
    default:
      return type?.charAt(0).toUpperCase() + type?.slice(1) || 'Unknown';
  }
};

const getPaymentMethodColor = (method) => {
  switch (method?.toLowerCase()) {
    case 'stripe':
      return 'text-blue-600 bg-blue-100';
    case 'stripe_subscription':
      return 'text-purple-600 bg-purple-100';
    case 'plaid':
      return 'text-green-600 bg-green-100';
    case 'bank_transfer':
      return 'text-orange-600 bg-orange-100';
    case 'cash':
      return 'text-gray-600 bg-gray-100';
    default:
      return 'text-blue-600 bg-blue-100';
  }
};

const getPaymentMethodLabel = (method) => {
  switch (method?.toLowerCase()) {
    case 'stripe':
      return 'Stripe';
    case 'stripe_subscription':
      return 'Stripe Subscription';
    case 'plaid':
      return 'Bank Transfer';
    case 'bank_transfer':
      return 'Bank Transfer';
    case 'cash':
      return 'Cash';
    default:
      return method?.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ') || 'Unknown';
  }
};

export default function TransactionManagementPage() {
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  // Filter states
  const [filterDonor, setFilterDonor] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTransactionType, setFilterTransactionType] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');

  // Fetch transactions on mount and when page/rowsPerPage change
  useEffect(() => {
    fetchTransactions();
  }, [page, rowsPerPage]);

  // Apply filters
  useEffect(() => {
    const filtered = transactions.filter((transaction) => {
      const matchesDonor = filterDonor
        ? transaction.donor.name.toLowerCase().includes(filterDonor.toLowerCase()) ||
          transaction.donor.email.toLowerCase().includes(filterDonor.toLowerCase())
        : true;
      const matchesStatus = filterStatus ? transaction.status === filterStatus : true;
      const matchesTransactionType = filterTransactionType ? transaction.transaction_type === filterTransactionType : true;
      const matchesPaymentMethod = filterPaymentMethod ? transaction.payment_method === filterPaymentMethod : true;
      return matchesDonor && matchesStatus && matchesTransactionType && matchesPaymentMethod;
    });
    setFilteredTransactions(filtered);
  }, [transactions, filterDonor, filterStatus, filterTransactionType, filterPaymentMethod]);

  const fetchTransactions = async () => {
    try {
      const response = await fetch(`/api/donor_transactions?page=${page + 1}&limit=${rowsPerPage}`);
      const data = await response.json();
      console.log('API Response:', data);
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to fetch transactions`);
      }

      if (!data.transactions || !Array.isArray(data.transactions)) {
        console.error('Unexpected response format:', data);
        throw new Error('Expected transactions data to be an array');
      }

      setTransactions(data.transactions);
      setTotalCount(data.totalCount || data.transactions.length);
      setLoading(false);
    } catch (err) {
      setError(`Failed to load transactions: ${err.message}`);
      setTransactions([]);
      setTotalCount(0);
      setLoading(false);
      console.error('Fetch error:', err);
    }
  };

  // Pagination handlers
  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter handlers
  const handleFilterDonorChange = (e) => setFilterDonor(e.target.value);
  const handleFilterStatusChange = (e) => setFilterStatus(e.target.value);
  const handleFilterTransactionTypeChange = (e) => setFilterTransactionType(e.target.value);
  const handleFilterPaymentMethodChange = (e) => setFilterPaymentMethod(e.target.value);

  // Animation variants
  const tableRowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const filterVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <Box sx={{ p: 3, bgcolor: '#FFF', minHeight: '100vh' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Transaction Management</h2>
      </div>

      {/* Filters */}
      <motion.div
        variants={filterVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.5 }}
        className="mb-6 bg-gray-50 p-4 rounded-lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <TextField
            label="Filter by Donor Name/Email"
            value={filterDonor}
            onChange={handleFilterDonorChange}
            variant="outlined"
            size="small"
            fullWidth
            sx={{ 
              '& .MuiInputBase-input': { color: '#111827' },
              '& .MuiOutlinedInput-root': { backgroundColor: 'white' }
            }}
          />
          <FormControl fullWidth size="small">
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={handleFilterStatusChange}
              label="Filter by Status"
              sx={{ backgroundColor: 'white' }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="completed">Completed</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Filter by Transaction Type</InputLabel>
            <Select
              value={filterTransactionType}
              onChange={handleFilterTransactionTypeChange}
              label="Filter by Transaction Type"
              sx={{ backgroundColor: 'white' }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="donation">Donation</MenuItem>
              <MenuItem value="refund">Refund</MenuItem>
              <MenuItem value="other">Other</MenuItem>
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Filter by Payment Method</InputLabel>
            <Select
              value={filterPaymentMethod}
              onChange={handleFilterPaymentMethodChange}
              label="Filter by Payment Method"
              sx={{ backgroundColor: 'white' }}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="credit_card">Credit Card</MenuItem>
              <MenuItem value="paypal">Stripe</MenuItem>
              <MenuItem value="paypal">Plaid</MenuItem>
              <MenuItem value="bank_transfer">Bank Transfer</MenuItem>
              <MenuItem value="cash">Cash</MenuItem>
            </Select>
          </FormControl>
        </div>
      </motion.div>

      {error && (
        <div className="mb-6">
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={fetchTransactions}>
                Retry
              </Button>
            }
          >
            {error}
          </Alert>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center p-6">
          <CircularProgress />
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Donor
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Transaction Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Receipt
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence>
                  {filteredTransactions.map((transaction, index) => (
                    <motion.tr
                      key={transaction.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {transaction.donor.name} ({transaction.donor.email})
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{transaction.organization.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {formatCurrency(transaction.amount, transaction.currency)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            transaction.status === 'completed'
                              ? 'bg-green-100 text-green-800'
                              : transaction.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getTransactionTypeColor(transaction.transaction_type)}`}>
                          {getTransactionTypeLabel(transaction.transaction_type)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPaymentMethodColor(transaction.payment_method)}`}>
                          {getPaymentMethodLabel(transaction.payment_method)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {transaction.receipt_url ? (
                            <a
                              href={transaction.receipt_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              View Receipt
                            </a>
                          ) : (
                            'N/A'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{formatDate(transaction.created_at)}</div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredTransactions.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No transactions found</h3>
              <p className="text-gray-500 mb-4">No transactions match your filters.</p>
            </div>
          )}

          {filteredTransactions.length > 0 && (
            <TablePagination
              rowsPerPageOptions={[5, 10, 25]}
              component="div"
              count={totalCount}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={handleChangePage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              className="border-t border-gray-200"
            />
          )}
        </div>
      )}
    </Box>
  );
}