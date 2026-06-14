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
  Menu,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import { Package, Download, FileSpreadsheet, FileText, Printer, Filter, DollarSign, CheckCircle, Clock } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
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

  // Fetch transactions on mount
  useEffect(() => {
    fetchTransactions();
    fetchOrganizations();
    fetchDonors();
  }, []);

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
      const response = await fetch(`/api/donor_transactions`);
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
      setLoading(false);
    } catch (err) {
      setError(`Failed to load transactions: ${err.message}`);
      setTransactions([]);
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
      // Get authentication token
      const token = localStorage.getItem('adminToken') || localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication required');
      }
      
      const response = await fetch('/api/admin/donors', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      if (data.donors) {
        setDonors(data.donors);
      }
    } catch (err) {
      console.error('Failed to fetch donors:', err);
    }
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
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    
    // Generate the HTML content for printing
    const printContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transaction Records - ${new Date().toLocaleDateString()}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              margin: 20px;
              font-size: 12px;
              line-height: 1.4;
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
              border-bottom: 2px solid #333;
              padding-bottom: 10px;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              color: #333;
            }
            .header p {
              margin: 5px 0 0 0;
              color: #666;
            }
            .summary {
              margin-bottom: 20px;
              padding: 10px;
              background-color: #f5f5f5;
              border-radius: 4px;
            }
            .summary p {
              margin: 5px 0;
              font-weight: bold;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 11px;
            }
            th, td {
              border: 1px solid #ddd;
              padding: 8px;
              text-align: left;
              vertical-align: top;
            }
            th {
              background-color: #f8f9fa;
              font-weight: bold;
              color: #333;
            }
            tr:nth-child(even) {
              background-color: #f9f9f9;
            }
            .status-completed { color: #28a745; font-weight: bold; }
            .status-pending { color: #ffc107; font-weight: bold; }
            .status-failed { color: #dc3545; font-weight: bold; }
            .amount { text-align: right; font-weight: bold; }
            @media print {
              body { margin: 0; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Transaction Records</h1>
            <p>Generated on: ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
          </div>
          
          <div class="summary">
            <p>Total Records: ${filteredTransactions.length}</p>
            <p>Total Amount: ${filteredTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0).toLocaleString('en-US', { style: 'currency', currency: 'USD' })}</p>
            <p>Filtered by: ${getActiveFilters()}</p>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Donor</th>
                <th>Organization</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Type</th>
                <th>Method</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${filteredTransactions.map(transaction => `
                <tr>
                  <td>${transaction.id}</td>
                  <td>${transaction.donor.name}<br><small>${transaction.donor.email}</small></td>
                  <td>${transaction.organization.name}</td>
                  <td class="amount">${formatCurrency(transaction.amount, transaction.currency)}</td>
                  <td class="status-${transaction.status}">${transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1)}</td>
                  <td>${getTransactionTypeLabel(transaction.transaction_type)}</td>
                  <td>${getPaymentMethodLabel(transaction.payment_method)}</td>
                  <td>${formatDate(transaction.created_at)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;
    
    // Write content to the new window
    printWindow.document.write(printContent);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
      printWindow.close();
    };
    
    handleExportClose();
  };
  
  // Helper function to get active filters for summary
  const getActiveFilters = () => {
    const filters = [];
    if (filterDonor) filters.push(`Donor: ${donors.find(d => d.id.toString() === filterDonor)?.name || 'Unknown'}`);
    if (filterOrganization) filters.push(`Organization: ${organizations.find(o => o.id.toString() === filterOrganization)?.name || 'Unknown'}`);
    if (filterStatus) filters.push(`Status: ${filterStatus}`);
    if (filterTransactionType) filters.push(`Type: ${filterTransactionType}`);
    if (filterPaymentMethod) filters.push(`Method: ${filterPaymentMethod}`);
    if (startDate) filters.push(`From: ${startDate}`);
    if (endDate) filters.push(`To: ${endDate}`);
    return filters.length > 0 ? filters.join(', ') : 'All records';
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

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <div className="bg-[#0E0061] rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-blue-100 mb-1">Total Transactions</p>
              <p className="text-3xl font-bold">{filteredTransactions.length}</p>
              <p className="text-xs text-blue-100 mt-1">
                {filteredTransactions.length !== transactions.length && `of ${transactions.length} total`}
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Package className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-green-100 mb-1">Total Amount</p>
              <p className="text-3xl font-bold">
                {formatCurrency(
                  filteredTransactions.reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
                  'USD'
                )}
              </p>
              <p className="text-xs text-green-100 mt-1">All transactions</p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-purple-100 mb-1">Completed</p>
              <p className="text-3xl font-bold">
                {formatCurrency(
                  filteredTransactions
                    .filter(t => t.status === 'completed')
                    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
                  'USD'
                )}
              </p>
              <p className="text-xs text-purple-100 mt-1">
                {filteredTransactions.filter(t => t.status === 'completed').length} transactions
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 shadow-lg text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-orange-100 mb-1">Pending</p>
              <p className="text-3xl font-bold">
                {formatCurrency(
                  filteredTransactions
                    .filter(t => t.status === 'pending')
                    .reduce((sum, t) => sum + parseFloat(t.amount || 0), 0),
                  'USD'
                )}
              </p>
              <p className="text-xs text-orange-100 mt-1">
                {filteredTransactions.filter(t => t.status === 'pending').length} transactions
              </p>
            </div>
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
              <Clock className="w-6 h-6" />
            </div>
          </div>
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
            <div className="px-6 py-4 border-t border-gray-200 text-sm text-gray-600">
              Showing {filteredTransactions.length} transaction{filteredTransactions.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      )}
    </Box>
  );
}