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
  IconButton,
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Download, FileSpreadsheet, FileText, Printer, Filter } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

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
  const [filterOrganization, setFilterOrganization] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTransactionType, setFilterTransactionType] = useState('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  
  // Data for filters
  const [organizations, setOrganizations] = useState([]);
  const [donors, setDonors] = useState([]);
  
  // Export menu state
  const [exportAnchorEl, setExportAnchorEl] = useState(null);

  // Fetch transactions on mount and when page/rowsPerPage change
  useEffect(() => {
    fetchTransactions();
    fetchOrganizations();
    fetchDonors();
  }, [page, rowsPerPage]);

  // Apply filters
  useEffect(() => {
    const filtered = transactions.filter((transaction) => {
      const matchesDonor = filterDonor
        ? transaction.donor.id.toString() === filterDonor
        : true;
      const matchesOrganization = filterOrganization
        ? transaction.organization.id.toString() === filterOrganization
        : true;
      const matchesStatus = filterStatus ? transaction.status === filterStatus : true;
      const matchesTransactionType = filterTransactionType ? transaction.transaction_type === filterTransactionType : true;
      const matchesPaymentMethod = filterPaymentMethod ? transaction.payment_method === filterPaymentMethod : true;
      
      // Date range filter
      const transactionDate = new Date(transaction.created_at);
      const matchesStartDate = startDate ? transactionDate >= new Date(startDate) : true;
      const matchesEndDate = endDate ? transactionDate <= new Date(endDate + 'T23:59:59') : true;
      
      return matchesDonor && matchesOrganization && matchesStatus && matchesTransactionType && matchesPaymentMethod && matchesStartDate && matchesEndDate;
    });
    setFilteredTransactions(filtered);
  }, [transactions, filterDonor, filterOrganization, filterStatus, filterTransactionType, filterPaymentMethod, startDate, endDate]);

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
  
  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations/list');
      const data = await response.json();
      if (data.success && data.organizations) {
        setOrganizations(data.organizations);
      }
    } catch (err) {
      console.error('Failed to fetch organizations:', err);
    }
  };
  
  const fetchDonors = async () => {
    try {
      const response = await fetch('/api/admin/donors');
      const data = await response.json();
      if (data.donors) {
        setDonors(data.donors);
      }
    } catch (err) {
      console.error('Failed to fetch donors:', err);
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
  const handleFilterOrganizationChange = (e) => setFilterOrganization(e.target.value);
  const handleFilterStatusChange = (e) => setFilterStatus(e.target.value);
  const handleFilterTransactionTypeChange = (e) => setFilterTransactionType(e.target.value);
  const handleFilterPaymentMethodChange = (e) => setFilterPaymentMethod(e.target.value);
  const handleStartDateChange = (e) => setStartDate(e.target.value);
  const handleEndDateChange = (e) => setEndDate(e.target.value);
  
  // Export handlers
  const handleExportClick = (event) => {
    setExportAnchorEl(event.currentTarget);
  };
  
  const handleExportClose = () => {
    setExportAnchorEl(null);
  };
  
  const exportToExcel = () => {
    const exportData = filteredTransactions.map(transaction => ({
      'Transaction ID': transaction.id,
      'Donor Name': transaction.donor.name,
      'Donor Email': transaction.donor.email,
      'Organization': transaction.organization.name,
      'Amount': transaction.amount,
      'Currency': transaction.currency,
      'Status': transaction.status,
      'Transaction Type': transaction.transaction_type,
      'Payment Method': transaction.payment_method,
      'Created At': formatDate(transaction.created_at)
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
    XLSX.writeFile(wb, `transactions_${new Date().toISOString().split('T')[0]}.xlsx`);
    handleExportClose();
  };
  
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.autoTable({
      head: [['ID', 'Donor', 'Organization', 'Amount', 'Status', 'Type', 'Method', 'Date']],
      body: filteredTransactions.map(transaction => [
        transaction.id,
        `${transaction.donor.name} (${transaction.donor.email})`,
        transaction.organization.name,
        `${transaction.amount} ${transaction.currency}`,
        transaction.status,
        transaction.transaction_type,
        transaction.payment_method,
        formatDate(transaction.created_at)
      ]),
      styles: { fontSize: 8 },
      margin: { top: 20 }
    });
    doc.save(`transactions_${new Date().toISOString().split('T')[0]}.pdf`);
    handleExportClose();
  };
  
  const printTable = () => {
    window.print();
    handleExportClose();
  };

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
    <Box sx={{ bgcolor: '#FFF', minHeight: '100vh' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Transaction Management</h2>
        <div className="flex items-center space-x-2">
          <Button
            variant="outlined"
            startIcon={<Filter />}
            onClick={() => {
              setFilterDonor('');
              setFilterOrganization('');
              setFilterStatus('');
              setFilterTransactionType('');
              setFilterPaymentMethod('');
              setStartDate('');
              setEndDate('');
            }}
          >
            Clear Filters
          </Button>
          <Button
            variant="contained"
            startIcon={<Download />}
            onClick={handleExportClick}
            sx={{ backgroundColor: '#3B82F6', '&:hover': { backgroundColor: '#2563EB' } }}
          >
            Export
          </Button>
          <Menu
            anchorEl={exportAnchorEl}
            open={Boolean(exportAnchorEl)}
            onClose={handleExportClose}
          >
            <MenuItem onClick={exportToExcel}>
              <ListItemIcon>
                <FileSpreadsheet className="w-4 h-4" />
              </ListItemIcon>
              <ListItemText>Export to Excel</ListItemText>
            </MenuItem>
            <MenuItem onClick={exportToPDF}>
              <ListItemIcon>
                <FileText className="w-4 h-4" />
              </ListItemIcon>
              <ListItemText>Export to PDF</ListItemText>
            </MenuItem>
            <MenuItem onClick={printTable}>
              <ListItemIcon>
                <Printer className="w-4 h-4" />
              </ListItemIcon>
              <ListItemText>Print</ListItemText>
            </MenuItem>
          </Menu>
        </div>
      </div>

      {/* Filters */}
      <motion.div
        variants={filterVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.5 }}
        className="mb-6 bg-gray-50 p-4 rounded-lg"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <FormControl fullWidth size="small">
            <InputLabel>Filter by Organization</InputLabel>
            <Select
              value={filterOrganization}
              onChange={handleFilterOrganizationChange}
              label="Filter by Organization"
              sx={{ backgroundColor: 'white' }}
            >
              <MenuItem value="">All Organizations</MenuItem>
              {organizations.map((org) => (
                <MenuItem key={org.id} value={org.id.toString()}>
                  {org.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth size="small">
            <InputLabel>Filter by Donor</InputLabel>
            <Select
              value={filterDonor}
              onChange={handleFilterDonorChange}
              label="Filter by Donor"
              sx={{ backgroundColor: 'white' }}
            >
              <MenuItem value="">All Donors</MenuItem>
              {donors.map((donor) => (
                <MenuItem key={donor.id} value={donor.id.toString()}>
                  {donor.name} ({donor.email})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Start Date"
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            variant="outlined"
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
            sx={{ 
              '& .MuiInputBase-input': { color: '#111827' },
              '& .MuiOutlinedInput-root': { backgroundColor: 'white' }
            }}
          />
          <TextField
            label="End Date"
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            variant="outlined"
            size="small"
            fullWidth
            InputLabelProps={{ shrink: true }}
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
              <MenuItem value="">All Status</MenuItem>
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
              <MenuItem value="">All Types</MenuItem>
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
              <MenuItem value="">All Methods</MenuItem>
              <MenuItem value="credit_card">Credit Card</MenuItem>
              <MenuItem value="stripe">Stripe</MenuItem>
              <MenuItem value="plaid">Plaid</MenuItem>
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
            <table className="w-full min-w-full">
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