'use client';
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Building2, 
  Mail, 
  Phone, 
  MapPin, 
  Globe, 
  Calendar,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Plus,
  ArrowLeft,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ManageGHLAccountsPage() {
  const router = useRouter();
  const [ghlAccounts, setGhlAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchGHLAccounts = useCallback(async () => {
    try {
      const orgUser = JSON.parse(localStorage.getItem('orgUser'));
      if (!orgUser) {
        router.push('/organization/login');
        return;
      }

      const response = await fetch(`/api/organization/ghl-account?organizationId=${orgUser.id}`);
      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'Failed to fetch GHL accounts');
        return;
      }

      setGhlAccounts(data.ghlAccounts || []);
    } catch (err) {
      console.error('Error fetching GHL accounts:', err);
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchGHLAccounts();
  }, [fetchGHLAccounts]);

  const handleDelete = async () => {
    if (!selectedAccount) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/organization/ghl-account?id=${selectedAccount.id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        setErrorMsg(data.error || 'Failed to delete GHL account');
        return;
      }

      // Remove from local state
      setGhlAccounts(prev => prev.filter(account => account.id !== selectedAccount.id));
      setShowDeleteModal(false);
      setSelectedAccount(null);
    } catch (err) {
      console.error('Error deleting GHL account:', err);
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setDeleting(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-600">Loading GHL accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="min-h-screen"
    >
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link href="/organization/dashboard" className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Link>
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Manage GHL Accounts</h1>
              <p className="text-gray-600">
                View and manage your GoHighLevel sub-accounts
              </p>
            </div>
            <Link href="/organization/dashboard/ghl/create">
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl flex items-center space-x-2">
                <Plus className="w-5 h-5" />
                <span>Create New Account</span>
              </button>
            </Link>
          </div>
        </div>

        <AnimatePresence>
          {errorMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3"
            >
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-red-700 text-sm">{errorMsg}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GHL Accounts Grid */}
        {ghlAccounts.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Building2 className="w-12 h-12 text-gray-400" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No GHL Accounts Yet</h3>
            <p className="text-gray-600 mb-6">Create your first GoHighLevel sub-account to get started</p>
            <Link href="/organization/dashboard/ghl/create">
              <button className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-lg hover:shadow-xl">
                Create Your First Account
              </button>
            </Link>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ghlAccounts.map((account, index) => (
              <motion.div
                key={account.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1, duration: 0.5 }}
                className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6 hover:shadow-xl transition-all duration-300"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-lg">{account.business_name}</h3>
                      <p className="text-sm text-gray-500">GHL Location ID: {account.ghl_location_id}</p>
                    </div>
                  </div>
                  <div className="relative">
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors duration-200">
                      <MoreVertical className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{account.email}</span>
                  </div>
                  {account.phone && (
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{account.phone}</span>
                    </div>
                  )}
                  {account.address && (
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <span>{account.address}, {account.city}, {account.state}</span>
                    </div>
                  )}
                  {account.website && (
                    <div className="flex items-center space-x-3 text-sm text-gray-600">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                        {account.website}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center space-x-3 text-sm text-gray-600">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span>Created {formatDate(account.created_at)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-gray-600 capitalize">{account.status}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors duration-200">
                      <Eye className="w-4 h-4" />
                    </button>
                    <button className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors duration-200">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedAccount(account);
                        setShowDeleteModal(true);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors duration-200"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setShowDeleteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-md"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="text-center">
                  <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">Delete GHL Account</h3>
                  <p className="text-gray-600 mb-6">
                    Are you sure you want to delete <strong>{selectedAccount?.business_name}</strong>? 
                    This action cannot be undone.
                  </p>
                  <div className="flex space-x-3">
                    <button
                      onClick={() => setShowDeleteModal(false)}
                      className="flex-1 py-3 px-4 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:border-gray-300 transition-all duration-200"
                      disabled={deleting}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 bg-red-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? (
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Deleting...</span>
                        </div>
                      ) : (
                        'Delete'
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
