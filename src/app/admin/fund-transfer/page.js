'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, 
  Search, 
  Filter, 
  Download, 
  Eye, 
  Edit, 
  Trash2, 
  Calendar,
  DollarSign,
  Building,
  Clock,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Clock as ClockIcon,
  TrendingUp,
  TrendingDown,
  MoreHorizontal,
  ArrowRightLeft
} from 'lucide-react';
import Link from 'next/link';

export default function FundTransferPage() {
  const [transfers, setTransfers] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [formData, setFormData] = useState({
    trnx_id: '',
    organization_id: '',
    amount: '',
    status: 'pending',
    receipt_url: '',
    transfer_date: '',
    transfer_time: '',
    description: ''
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  // Fetch transfers and organizations on component mount
  useEffect(() => {
    fetchTransfers();
    fetchOrganizations();
  }, []);

  const fetchTransfers = async () => {
    try {
      const response = await fetch('/api/fund-transfers');
      if (response.ok) {
        const data = await response.json();
        setTransfers(data);
      }
    } catch (error) {
      console.error('Error fetching transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchOrganizations = async () => {
    try {
      const response = await fetch('/api/organizations/list');
      const data = await response.json();
      
      if (data.success && data.organizations) {
        setOrganizations(data.organizations);
        console.log(`✅ Loaded ${data.count} organizations`);
      } else {
        console.error('❌ Failed to fetch organizations:', data.error);
        // Set empty array to prevent form errors
        setOrganizations([]);
      }
    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      // Set empty array to prevent form errors
      setOrganizations([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear error when user starts typing
    if (formErrors[name]) {
      setFormErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    
    if (!formData.trnx_id.trim()) errors.trnx_id = 'Transaction ID is required';
    if (!formData.organization_id) errors.organization_id = 'Organization is required';
    if (!formData.amount || parseFloat(formData.amount) <= 0) errors.amount = 'Valid amount is required';
    if (!formData.status) errors.status = 'Status is required';
    if (!formData.transfer_date) errors.transfer_date = 'Transfer date is required';
    if (!formData.transfer_time) errors.transfer_time = 'Transfer time is required';

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setSubmitting(true);
    
    try {
      const response = await fetch('/api/fund-transfers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        // Reset form and close modal
        setFormData({
          trnx_id: '',
          organization_id: '',
          amount: '',
          status: 'pending',
          receipt_url: '',
          transfer_date: '',
          transfer_time: '',
          description: ''
        });
        setFormErrors({});
        setShowModal(false);
        
        // Refresh the transfers list
        fetchTransfers();
      } else {
        alert(data.error || 'Failed to create transfer');
      }
    } catch (error) {
      console.error('Error creating transfer:', error);
      alert('Failed to create transfer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this transfer?')) return;

    try {
      const response = await fetch(`/api/fund-transfers/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        fetchTransfers();
      } else {
        alert('Failed to delete transfer');
      }
    } catch (error) {
      console.error('Error deleting transfer:', error);
      alert('Failed to delete transfer');
    }
  };

  const filteredTransfers = transfers.filter(transfer => {
    const matchesSearch = 
      transfer.trnx_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.organization?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      transfer.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = filterStatus === 'all' || transfer.status === filterStatus;
    
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status.toLowerCase()) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'failed': return <AlertCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatAmount = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Calculate summary stats
  const totalTransfers = transfers.length;
  const completedTransfers = transfers.filter(t => t.status === 'completed').length;
  const pendingTransfers = transfers.filter(t => t.status === 'pending').length;
  const totalAmount = transfers.reduce((sum, t) => sum + parseFloat(t.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Fund Transfers</h1>
          <p className="text-gray-600 mt-1">Manage and track all fund transfers across organizations</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 shadow-sm"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add New Transfer
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Transfers</p>
              <p className="text-2xl font-bold text-gray-900">{totalTransfers}</p>
            </div>
            <div className="p-3 bg-blue-50 rounded-lg">
              <ArrowRightLeft className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{completedTransfers}</p>
            </div>
            <div className="p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-yellow-600">{pendingTransfers}</p>
            </div>
            <div className="p-3 bg-yellow-50 rounded-lg">
              <Clock className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Amount</p>
              <p className="text-2xl font-bold text-gray-900">{formatAmount(totalAmount)}</p>
            </div>
            <div className="p-3 bg-purple-50 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                placeholder="Search transfers by ID, organization, or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200 text-gray-900"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transfers List */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Organization
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransfers.map((transfer) => (
                <motion.tr
                  key={transfer.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="hover:bg-gray-50 transition-colors duration-200"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900">
                      {transfer.trnx_id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center mr-3">
                        <Building className="w-4 h-4 text-blue-600" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {transfer.organization?.name || 'N/A'}
                        </div>
                        <div className="text-sm text-gray-500">
                          {transfer.organization?.email || 'N/A'}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">
                      {formatAmount(transfer.amount)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getStatusColor(transfer.status)}`}>
                      {getStatusIcon(transfer.status)}
                      <span className="ml-1">{transfer.status}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {formatDate(transfer.transfer_date)}
                    </div>
                    <div className="text-sm text-gray-500">
                      {transfer.transfer_time}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {/* View details */}}
                        className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded-lg transition-colors duration-200"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {/* Edit transfer */}}
                        className="p-2 text-green-600 hover:text-green-900 hover:bg-green-50 rounded-lg transition-colors duration-200"
                        title="Edit transfer"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(transfer.id)}
                        className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-lg transition-colors duration-200"
                        title="Delete transfer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredTransfers.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 text-lg font-medium">No transfers found</div>
            <p className="text-gray-400 mt-1">Try adjusting your search or filter criteria</p>
          </div>
        )}
      </div>

      {/* Add Transfer Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Add New Fund Transfer</h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Transaction ID */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transaction ID *
                    </label>
                    <input
                      type="text"
                      name="trnx_id"
                      value={formData.trnx_id}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900 ${
                        formErrors.trnx_id ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter transaction ID"
                    />
                    {formErrors.trnx_id && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.trnx_id}</p>
                    )}
                  </div>

                  {/* Organization */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization *
                    </label>
                    <select
                      name="organization_id"
                      value={formData.organization_id}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900 ${
                        formErrors.organization_id ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select organization</option>
                      {organizations.map((org) => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                    {formErrors.organization_id && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.organization_id}</p>
                    )}
                  </div>

                  {/* Amount */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Amount *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">$</span>
                      <input
                        type="number"
                        name="amount"
                        value={formData.amount}
                        onChange={handleInputChange}
                        step="0.01"
                        min="0"
                        className={`w-full pl-8 pr-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900 ${
                          formErrors.amount ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="0.00"
                      />
                    </div>
                    {formErrors.amount && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.amount}</p>
                    )}
                  </div>

                  {/* Status */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status *
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900 ${
                        formErrors.status ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="pending">Pending</option>
                      <option value="completed">Completed</option>
                      <option value="failed">Failed</option>
                    </select>
                    {formErrors.status && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.status}</p>
                    )}
                  </div>

                  {/* Transfer Date */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transfer Date *
                    </label>
                    <input
                      type="date"
                      name="transfer_date"
                      value={formData.transfer_date}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900 ${
                        formErrors.transfer_date ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.transfer_date && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.transfer_date}</p>
                    )}
                  </div>

                  {/* Transfer Time */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Transfer Time *
                    </label>
                    <input
                      type="time"
                      name="transfer_time"
                      value={formData.transfer_time}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900 ${
                        formErrors.transfer_time ? 'border-red-300' : 'border-gray-300'
                      }`}
                    />
                    {formErrors.transfer_time && (
                      <p className="mt-1 text-sm text-red-600">{formErrors.transfer_time}</p>
                    )}
                  </div>
                </div>

                {/* Receipt URL */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt URL
                  </label>
                  <input
                    type="url"
                    name="receipt_url"
                    value={formData.receipt_url}
                    onChange={handleInputChange}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900"
                    placeholder="https://example.com/receipt"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all duration-200 text-gray-900"
                    placeholder="Enter transfer description..."
                  />
                </div>

                {/* Form Actions */}
                <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                  >
                    {submitting ? 'Saving...' : 'Save Transfer'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
