'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { motion, AnimatePresence } from 'framer-motion';
import { Target, X, Loader2, CheckCircle, AlertCircle, Building2, Search, Heart, ArrowLeft, ArrowRight } from 'lucide-react';

const PlaidIntegration = ({ isOpen, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [currentStep, setCurrentStep] = useState(1); // 1: Select Organization, 2: Connect Bank
  
  // Organization selection state
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  // Fetch organizations when component mounts
  useEffect(() => {
    if (isOpen) {
      fetchOrganizations();
    }
  }, [isOpen]);

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      const response = await fetch('/api/organizations/list');
      if (response.ok) {
        const data = await response.json();
        // Handle both array response and object with organizations property
        const orgs = Array.isArray(data) ? data : (data?.organizations || []);
        setOrganizations(orgs);
      }
    } catch (error) {
      console.error('Error fetching organizations:', error);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const onPlaidSuccess = useCallback(async (publicToken, metadata) => {
    setLoading(true);
    setError('');

    try {
      console.log('Plaid Link Success - Starting token exchange...');
      console.log('Public token:', publicToken ? 'Received' : 'Missing');
      console.log('Metadata:', metadata);
      
      // Get donor info from token
      const token = localStorage.getItem('token');
      const decoded = JSON.parse(atob(token.split('.')[1]));
      const donorId = decoded.id;

      // Call your backend API to exchange public token for access token
      console.log('Exchanging public token for access token...');
      const exchangePayload = {
        public_token: publicToken,
        metadata: metadata,
        organization_id: selectedOrganization.id,
        donor_id: donorId
      };
      console.log('Exchange payload:', exchangePayload);

      const response = await fetch('/api/plaid/exchange-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(exchangePayload)
      });

      console.log('Exchange response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Token exchange failed:', errorData);
        const errorMessage = `Token exchange failed: ${errorData.error || 'Unknown error'}`;
        alert(errorMessage);
        throw new Error('Failed to exchange token');
      }

      const result = await response.json();
      console.log('Token exchange successful:', result);
      
      // Show Plaid response in alert dialog
      const alertMessage = `Plaid Connection Successful!\n\n` +
        `Organization: ${selectedOrganization?.name}\n` +
        `Institution: ${result.connection?.institution_name || 'Unknown'}\n` +
        `Accounts: ${result.connection?.accounts_count || 0}\n` +
        `Status: ${result.connection?.status || 'Unknown'}\n` +
        `Connection ID: ${result.connection?.id || 'N/A'}`;
      
      alert(alertMessage);
      
      setSuccess(true);
      
      // Call success callback after a short delay
      setTimeout(() => {
        onSuccess(result);
        onClose();
      }, 2000);

    } catch (err) {
      console.error('Plaid integration error:', err);
      const errorMessage = `Plaid Connection Failed!\n\nError: ${err.message || 'Unknown error occurred'}\n\nPlease try again.`;
      alert(errorMessage);
      setError('Failed to connect bank account. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [onSuccess, onClose]);

  const onPlaidExit = useCallback((err, metadata) => {
    if (err) {
      console.error('Plaid Link Exit Error:', err);
      const exitMessage = `Plaid Connection Cancelled!\n\nReason: ${err.error_message || err.error_code || 'User cancelled'}\n\nYou can try again anytime.`;
      alert(exitMessage);
      setError('Connection was cancelled or failed. Please try again.');
    }
  }, []);

  const [linkToken, setLinkToken] = useState(null);

  const config = {
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: onPlaidExit,
  };

  const { open, ready } = usePlaidLink(config);

  const handleConnect = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('Starting Plaid connection process...');
      console.log('Selected organization:', selectedOrganization);

      // Get donor info from token
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('No authentication token found. Please log in again.');
      }

      const decoded = JSON.parse(atob(token.split('.')[1]));
      const donorId = decoded.id;
      console.log('Donor ID:', donorId);

      // Get link token from backend
      console.log('Creating link token...');
      const response = await fetch('/api/plaid/create-link-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organization_id: selectedOrganization.id,
          donor_id: donorId
        })
      });

      console.log('Link token response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Link token creation failed:', errorData);
        const errorMessage = `Failed to create link token: ${errorData.error || 'Unknown error'}`;
        alert(errorMessage);
        throw new Error(errorData.error || 'Failed to create link token');
      }

      const { link_token } = await response.json();
      console.log('Link token received:', link_token ? 'Success' : 'Failed');
      
      // Set the link token to trigger Plaid Link initialization
      setLinkToken(link_token);
      
    } catch (err) {
      console.error('Error creating link token:', err);
      const errorMessage = `Failed to initialize bank connection: ${err.message}`;
      alert(errorMessage);
      setError('Failed to initialize bank connection. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Open Plaid Link when token is ready
  useEffect(() => {
    if (linkToken && ready) {
      console.log('Opening Plaid Link with token:', linkToken.substring(0, 20) + '...');
      try {
        open();
        console.log('Plaid Link opened successfully');
      } catch (error) {
        console.error('Error opening Plaid Link:', error);
        alert(`Error opening Plaid Link: ${error.message}`);
      }
    }
  }, [linkToken, ready, open]);

  const handleNext = () => {
    if (currentStep === 1) {
      if (!selectedOrganization) {
        setError('Please select an organization');
        return;
      }
      setError('');
      setCurrentStep(2);
    }
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(1);
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto mx-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-purple-600 rounded-xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Plaid Integration</h3>
                <p className="text-sm text-gray-600">Connect your bank account securely</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
            >
              <X size={24} />
            </button>
          </div>

          {!success ? (
            <>
              {/* Step Indicator */}
              <div className="flex items-center justify-center space-x-4 mb-6">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  currentStep >= 1 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}>
                  <Building2 className="w-4 h-4" />
                </div>
                <div className={`w-8 h-0.5 ${currentStep >= 2 ? 'bg-blue-600' : 'bg-gray-300'}`} />
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-200 ${
                  currentStep >= 2 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'bg-gray-100 border-gray-300 text-gray-400'
                }`}>
                  <Target className="w-4 h-4" />
                </div>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-red-700 text-sm">{error}</p>
                </div>
              )}

              <AnimatePresence mode="wait">
                {currentStep === 1 && (
                  <motion.div
                    key="step1"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="w-8 h-8 text-blue-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">Select Organization</h4>
                      <p className="text-gray-600 text-sm">Choose which organization will receive your bank connection</p>
                    </div>

                    <div className="max-w-2xl mx-auto">
                      <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search organizations..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>

                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {loadingOrgs ? (
                          <div className="text-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-blue-600 mx-auto mb-2" />
                            <p className="text-gray-600">Loading organizations...</p>
                          </div>
                        ) : filteredOrganizations.length > 0 ? (
                          filteredOrganizations.map((org) => (
                            <button
                              key={org.id}
                              onClick={() => setSelectedOrganization(org)}
                              className={`w-full p-4 rounded-lg border-2 transition-all duration-200 text-left ${
                                selectedOrganization?.id === org.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                              }`}
                            >
                              <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                                  <Heart className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h5 className="font-semibold text-gray-900 truncate">{org.name}</h5>
                                  <p className="text-sm text-gray-600 truncate">{org.email}</p>
                                </div>
                                {selectedOrganization?.id === org.id && (
                                  <CheckCircle className="w-5 h-5 text-blue-600 flex-shrink-0" />
                                )}
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="text-center py-8">
                            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-600">No organizations found</p>
                            <p className="text-sm text-gray-400">Try adjusting your search terms</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStep === 2 && (
                  <motion.div
                    key="step2"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center">
                      <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Target className="w-8 h-8 text-purple-600" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">Connect Your Bank Account</h4>
                      <p className="text-gray-600 text-sm">
                        Securely link your bank account using Plaid for {selectedOrganization?.name}
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-lg p-4">
                      <h5 className="font-semibold text-gray-900 mb-2">Selected Organization:</h5>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center">
                          <Heart className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{selectedOrganization?.name}</p>
                          <p className="text-sm text-gray-600">{selectedOrganization?.email}</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleConnect}
                      disabled={loading}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center space-x-2">
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Connecting to Plaid...</span>
                        </div>
                      ) : (
                        'Connect Bank Account with Plaid'
                      )}
                    </button>

                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-600">
                        <strong>Note:</strong> This will open Plaid Link in a secure popup window to connect your bank account.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-6 border-t border-gray-200">
                <button
                  onClick={currentStep === 1 ? onClose : handleBack}
                  className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
                </button>

                {currentStep === 1 && (
                  <button
                    onClick={handleNext}
                    disabled={!selectedOrganization}
                    className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-900 mb-2">Bank Account Connected!</h4>
              <p className="text-gray-600 mb-4">
                Your bank account has been successfully connected through Plaid.
              </p>
              <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Returning to dashboard...</span>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PlaidIntegration;
