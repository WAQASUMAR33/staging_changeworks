'use client';

import { useState, useEffect } from 'react';
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  X, 
  ArrowLeft, 
  ArrowRight,
  DollarSign,
  Building2,
  CreditCard,
  Search,
  Heart
} from 'lucide-react';

const CARD_ELEMENT_OPTIONS = {
  style: {
    base: {
      fontSize: '16px',
      color: '#424770',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#9e2146',
    },
  },
};

export default function MultiStepPaymentForm({ 
  onSuccess, 
  onError, 
  onCancel 
}) {
  const stripe = useStripe();
  const elements = useElements();
  
  // Step management
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [paymentStatus, setPaymentStatus] = useState(''); // 'processing', 'success', 'error'
  
  // Step 1: Donation Amount
  const [donationAmount, setDonationAmount] = useState('');
  const [amountError, setAmountError] = useState('');
  
  // Step 2: Organization Selection
  const [organizations, setOrganizations] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  
  // Step 3: Checkout
  const [message, setMessage] = useState('');

  const steps = [
    { id: 1, title: 'Donation Amount', icon: DollarSign },
    { id: 2, title: 'Select Organization', icon: Building2 },
    { id: 3, title: 'Checkout', icon: CreditCard },
  ];

  // Fetch organizations when component mounts
  useEffect(() => {
    fetchOrganizations();
  }, []);

  const fetchOrganizations = async () => {
    try {
      setLoadingOrgs(true);
      const response = await fetch('/api/organizations/list');
      const data = await response.json();
      
      if (data.success && data.organizations && Array.isArray(data.organizations)) {
        setOrganizations(data.organizations);
        console.log(`✅ Loaded ${data.count} organizations for payment`);
      } else {
        console.error('❌ Failed to fetch organizations:', data.error);
        setOrganizations([]);
      }
    } catch (error) {
      console.error('❌ Error fetching organizations:', error);
      setOrganizations([]);
    } finally {
      setLoadingOrgs(false);
    }
  };

  const validateAmount = (amount) => {
    const numAmount = parseFloat(amount);
    if (!amount || isNaN(numAmount)) {
      return 'Please enter a valid amount';
    }
    if (numAmount < 1) {
      return 'Minimum donation amount is $1.00';
    }
    if (numAmount > 10000) {
      return 'Maximum donation amount is $10,000.00';
    }
    return '';
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    setDonationAmount(value);
    setAmountError(validateAmount(value));
  };

  const handleNext = () => {
    if (currentStep === 1) {
      const error = validateAmount(donationAmount);
      if (error) {
        setAmountError(error);
        return;
      }
    } else if (currentStep === 2) {
      if (!selectedOrganization) {
        setError('Please select an organization');
        return;
      }
    }
    setError('');
    setCurrentStep(currentStep + 1);
  };

  const handleBack = () => {
    setError('');
    setCurrentStep(currentStep - 1);
  };

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    org.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setError('Payment system not ready. Please try again.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Get donor info from localStorage
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      console.log('🔍 MultiStepPaymentForm - User data:', user);
      
      if (!user.id) {
        setError('Please log in to make a payment');
        return;
      }

      // Create payment intent
      const response = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          amount: parseFloat(donationAmount) * 100, // Convert to cents
          currency: 'USD',
          donor_id: parseInt(user.id),
          organization_id: selectedOrganization.id,
          description: message || `Donation to ${selectedOrganization.name}`,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create payment intent');
      }

      const { client_secret } = await response.json();

      // Confirm payment
      const cardElement = elements.getElement(CardElement);
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(client_secret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (stripeError) {
        throw new Error(stripeError.message);
      }

      if (paymentIntent.status === 'succeeded') {
        setPaymentStatus('success');
        onSuccess(paymentIntent);
      } else {
        throw new Error('Payment was not successful');
      }

    } catch (err) {
      console.error('Payment error:', err);
      setError(err.message || 'Payment failed. Please try again.');
      setPaymentStatus('error');
      onError(err);
    } finally {
      setLoading(false);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center space-x-4 mb-8">
      {steps.map((step, index) => {
        const Icon = step.icon;
        const isActive = currentStep === step.id;
        const isCompleted = currentStep > step.id;
        
        return (
          <div key={step.id} className="flex items-center">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-200 ${
              isCompleted 
                ? 'bg-green-500 border-green-500 text-white' 
                : isActive 
                  ? 'bg-blue-600 border-blue-600 text-white' 
                  : 'bg-gray-100 border-gray-300 text-gray-400'
            }`}>
              {isCompleted ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Icon className="w-5 h-5" />
              )}
            </div>
            <span className={`ml-2 text-sm font-medium ${
              isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
            }`}>
              {step.title}
            </span>
            {index < steps.length - 1 && (
              <div className={`w-8 h-0.5 mx-4 ${
                isCompleted ? 'bg-green-500' : 'bg-gray-300'
              }`} />
            )}
          </div>
        );
      })}
    </div>
  );

  const renderStep1 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <DollarSign className="w-8 h-8 text-blue-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Enter Donation Amount</h3>
        <p className="text-gray-600">How much would you like to donate?</p>
      </div>

      <div className="max-w-md mx-auto">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Donation Amount *
        </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">$</span>
          <input
            type="number"
            value={donationAmount}
            onChange={handleAmountChange}
            placeholder="0.00"
            className={`w-full pl-8 pr-4 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 text-lg ${
              amountError ? 'border-red-300' : 'border-gray-300'
            }`}
            min="1"
            max="10000"
            step="0.01"
            required
          />
        </div>
        {amountError && (
          <p className="mt-2 text-sm text-red-600 flex items-center">
            <AlertCircle className="w-4 h-4 mr-1" />
            {amountError}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-md mx-auto">
        {[25, 50, 100, 250].map((amount) => (
          <button
            key={amount}
            onClick={() => {
              setDonationAmount(amount.toString());
              setAmountError(validateAmount(amount.toString()));
            }}
            className={`p-3 rounded-lg border-2 transition-all duration-200 ${
              donationAmount === amount.toString()
                ? 'border-blue-500 bg-blue-50 text-blue-700'
                : 'border-gray-200 hover:border-gray-300 text-gray-700'
            }`}
          >
            <span className="font-semibold">${amount}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Building2 className="w-8 h-8 text-green-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Select Organization</h3>
        <p className="text-gray-600">Choose which organization will receive your donation</p>
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

        <div className="max-h-96 overflow-y-auto space-y-2">
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
                  <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Heart className="w-6 h-6 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-900 truncate">{org.name}</h4>
                    <p className="text-sm text-gray-600 truncate">{org.email}</p>
                    {org.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{org.description}</p>
                    )}
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
  );

  const renderStep3 = () => (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      <div className="text-center">
        <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CreditCard className="w-8 h-8 text-purple-600" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 mb-2">Complete Payment</h3>
        <p className="text-gray-600">Enter your payment details to complete the donation</p>
      </div>

      <div className="max-w-md mx-auto space-y-6">
        {/* Donation Summary */}
        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="font-semibold text-gray-900 mb-3">Donation Summary</h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Amount:</span>
              <span className="font-semibold">${donationAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Organization:</span>
              <span className="font-semibold text-right max-w-48 truncate">{selectedOrganization?.name}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between">
                <span className="font-semibold text-gray-900">Total:</span>
                <span className="font-bold text-lg text-blue-600">${donationAmount}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Message */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Message (Optional)
          </label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="3"
            placeholder="Add a message with your donation..."
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
          />
        </div>

        {/* Card Element */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Payment Information *
          </label>
          <div className="p-4 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-blue-500 transition-all duration-200">
            <CardElement options={CARD_ELEMENT_OPTIONS} />
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderNavigation = () => (
    <div className="flex justify-between items-center pt-6 border-t border-gray-200">
      <button
        onClick={currentStep === 1 ? onCancel : handleBack}
        className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors duration-200"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{currentStep === 1 ? 'Cancel' : 'Back'}</span>
      </button>

      {currentStep < 3 ? (
        <button
          onClick={handleNext}
          disabled={loading}
          className="flex items-center space-x-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span>Next</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      ) : (
        <button
          onClick={handleSubmit}
          disabled={loading || !stripe || !elements}
          className="flex items-center space-x-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Processing...</span>
            </>
          ) : (
            <>
              <span>Complete Donation</span>
              <CheckCircle className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );

  // Show loading state if Stripe is not ready
  if (!stripe || !elements) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
        </div>
        <h4 className="text-lg font-semibold text-gray-900 mb-2">Loading Payment Form</h4>
        <p className="text-gray-600 mb-4">
          Please wait while we initialize the secure payment system...
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderStepIndicator()}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <AnimatePresence mode="wait">
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
      </AnimatePresence>

      {renderNavigation()}
    </div>
  );
}
