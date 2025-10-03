'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, User, Mail, Lock, Phone, MapPin, Building, Loader2, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function DonorSignupPage() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    country: 'US',
    city: '',
    address: '',
    postal_code: '',
    password: '',
    confirmPassword: '',
    organization_id: ''
  });
  const [organizations, setOrganizations] = useState([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState({});

  const filteredOrganizations = useMemo(() => {
    const q = orgSearch.toLowerCase();
    return organizations.filter(o => (o.name || '').toLowerCase().includes(q));
  }, [orgSearch, organizations]);

  useEffect(() => {
    if (currentStep === 4 && organizations.length === 0) {
      fetch('/api/organizations/list')
        .then(r => r.json())
        .then(data => setOrganizations(Array.isArray(data) ? data : (data.organizations || [])))
        .catch(() => setOrganizations([]));
    }
  }, [currentStep, organizations.length]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear specific field error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
    
    // Clear general error message when user starts typing
    if (error) {
      setError('');
    }
  };

  const validateStep = (step) => {
    const newErrors = {};
    
    if (step === 1) {
      if (!formData.name.trim()) newErrors.name = 'Full name is required';
      if (!formData.email.trim()) newErrors.email = 'Email is required';
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Enter a valid email';
      if (!formData.phone.trim()) newErrors.phone = 'Phone number is required';
    }
    
    if (step === 2) {
      if (!formData.country) newErrors.country = 'Country is required';
      if (!formData.city.trim()) newErrors.city = 'City is required';
      if (!formData.address.trim()) newErrors.address = 'Address is required';
      if (!formData.postal_code.trim()) newErrors.postal_code = 'Postal code is required';
    }
    
    if (step === 3) {
      if (formData.password.length < 6) newErrors.password = 'Password must be at least 6 characters';
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (step === 4) {
      if (!formData.organization_id) newErrors.organization_id = 'Please select an organization';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const goNext = () => {
    if (validateStep(currentStep)) {
      setError('');
      setCurrentStep(prev => Math.min(prev + 1, 5));
    }
  };

  const goBack = () => {
    setError('');
    setErrors({});
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateStep(currentStep)) return;

    // Final submit (step 5)
    setLoading(true);
    setMessage('');
    setError('');
    
    try {
      const response = await fetch('/api/donor/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
          phone: formData.phone.trim(),
          city: formData.city.trim(),
          address: formData.address.trim(),
          postal_code: formData.postal_code.trim(),
          country: formData.country,
          organization_id: Number(formData.organization_id)
        })
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage('Account created successfully! Please check your email to verify your account.');
        setTimeout(() => router.push('/donor/login'), 2000);
      } else {
        setError(data.error || 'Failed to create account');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        duration: 0.6,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.5 }
    }
  };

  const steps = [
    { id: 1, title: 'Personal Info', icon: User },
    { id: 2, title: 'Address', icon: MapPin },
    { id: 3, title: 'Security', icon: Lock },
    { id: 4, title: 'Organization', icon: Building },
    { id: 5, title: 'Review', icon: CheckCircle }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 flex flex-col lg:flex-row overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Left Side - Brand Section */}
      <motion.div
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full lg:w-1/2 flex flex-col justify-center items-center p-8 lg:p-12 text-center z-10"
      >
        <div className="max-w-md">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mb-8"
          >
            <Image
              src="/imgs/changeworks.jpg"
              alt="ChangeWorks Logo"
              width={200}
              height={200}
              className="mx-auto rounded-2xl shadow-2xl border-4 border-white/20 backdrop-blur-sm"
              priority
            />
          </motion.div>
          
          <motion.h1 
            variants={itemVariants}
            className="text-4xl lg:text-5xl font-bold bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent mb-4"
          >
            Join ChangeWorks
          </motion.h1>
          
          <motion.p 
            variants={itemVariants}
            className="text-lg text-gray-600 mb-8 leading-relaxed"
          >
            Create your donor account and start making a positive impact in the world
          </motion.p>
          
          <motion.div 
            variants={itemVariants}
            className="flex items-center justify-center space-x-4 text-sm text-gray-500"
          >
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Secure Registration</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span>Easy Donations</span>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Right Side - Signup Form */}
      <motion.div
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative w-full lg:w-1/2 flex justify-center items-center p-8 lg:p-12 z-10"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="w-full max-w-2xl"
        >
          <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/20 p-8 lg:p-10">
            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
            >
              <motion.h2 
                variants={itemVariants}
                className="text-3xl font-bold text-center mb-2 bg-gradient-to-r from-gray-800 to-gray-600 bg-clip-text text-transparent"
              >
                Create Donor Account
              </motion.h2>
              
              <motion.p 
                variants={itemVariants}
                className="text-center text-gray-600 mb-8"
              >
                Step {currentStep} of 5: {steps[currentStep - 1]?.title}
              </motion.p>

              {/* Progress Steps */}
              <motion.div variants={itemVariants} className="mb-8">
                <div className="flex items-center justify-between">
                  {steps.map((step, index) => {
                    const Icon = step.icon;
                    const isActive = currentStep === step.id;
                    const isCompleted = currentStep > step.id;
                    
                    return (
                      <div key={step.id} className="flex flex-col items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 ${
                          isActive 
                            ? 'bg-blue-600 border-blue-600 text-white' 
                            : isCompleted 
                            ? 'bg-green-500 border-green-500 text-white' 
                            : 'bg-gray-100 border-gray-300 text-gray-400'
                        }`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className={`text-xs mt-2 font-medium ${
                          isActive ? 'text-blue-600' : isCompleted ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {step.title}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </motion.div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3"
                  >
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                    <p className="text-red-700 text-sm">{error}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3"
                  >
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <p className="text-green-700 text-sm">{message}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Step 1: Personal Information */}
                {currentStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Full Name *
                      </label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          name="name"
                          type="text"
                          placeholder="Enter your full name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                            errors.name 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                          }`}
                        />
                      </div>
                      <AnimatePresence>
                        {errors.name && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>{errors.name}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Email Address *
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          name="email"
                          type="email"
                          placeholder="Enter your email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                            errors.email 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                          }`}
                        />
                      </div>
                      <AnimatePresence>
                        {errors.email && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>{errors.email}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Phone Number *
                      </label>
                      <div className="relative">
                        <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          name="phone"
                          type="tel"
                          placeholder="+1234567890"
                          value={formData.phone}
                          onChange={handleInputChange}
                          className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                            errors.phone 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                          }`}
                        />
                      </div>
                      <AnimatePresence>
                        {errors.phone && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>{errors.phone}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {/* Step 2: Address */}
                {currentStep === 2 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          Country *
                        </label>
                        <select
                          name="country"
                          value={formData.country}
                          onChange={handleInputChange}
                          className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                            errors.country 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                          }`}
                        >
                          <option value="US">United States</option>
                          <option value="CA">Canada</option>
                          <option value="GB">United Kingdom</option>
                          <option value="AU">Australia</option>
                          <option value="DE">Germany</option>
                          <option value="FR">France</option>
                          <option value="other">Other</option>
                        </select>
                        <AnimatePresence>
                          {errors.country && (
                            <motion.p 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                            >
                              <AlertCircle className="w-3 h-3" />
                              <span>{errors.country}</span>
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                          City *
                        </label>
                        <div className="relative">
                          <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input
                            name="city"
                            type="text"
                            placeholder="Enter your city"
                            value={formData.city}
                            onChange={handleInputChange}
                            className={`w-full pl-10 pr-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                              errors.city 
                                ? 'border-red-300 bg-red-50' 
                                : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                            }`}
                          />
                        </div>
                        <AnimatePresence>
                          {errors.city && (
                            <motion.p 
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -5 }}
                              className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                            >
                              <AlertCircle className="w-3 h-3" />
                              <span>{errors.city}</span>
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Address *
                      </label>
                      <input
                        name="address"
                        type="text"
                        placeholder="123 Main Street"
                        value={formData.address}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                          errors.address 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                        }`}
                      />
                      <AnimatePresence>
                        {errors.address && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>{errors.address}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Postal Code *
                      </label>
                      <input
                        name="postal_code"
                        type="text"
                        placeholder="ZIP / Postal Code"
                        value={formData.postal_code}
                        onChange={handleInputChange}
                        className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                          errors.postal_code 
                            ? 'border-red-300 bg-red-50' 
                            : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                        }`}
                      />
                      <AnimatePresence>
                        {errors.postal_code && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>{errors.postal_code}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {/* Step 3: Security */}
                {currentStep === 3 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Password *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Create a password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                            errors.password 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                        >
                          {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      <AnimatePresence>
                        {errors.password && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>{errors.password}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Confirm Password *
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          name="confirmPassword"
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Confirm your password"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all duration-200 ${
                            errors.confirmPassword 
                              ? 'border-red-300 bg-red-50' 
                              : 'border-gray-200 hover:border-gray-300 focus:border-blue-500'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors duration-200"
                        >
                          {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                      </div>
                      <AnimatePresence>
                        {errors.confirmPassword && (
                          <motion.p 
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            className="text-red-500 text-sm mt-1 flex items-center space-x-1"
                          >
                            <AlertCircle className="w-3 h-3" />
                            <span>{errors.confirmPassword}</span>
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                )}

                {/* Step 4: Organization Selection */}
                {currentStep === 4 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Search Organization *
                      </label>
                      <div className="relative">
                        <Building className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          placeholder="Search organization..."
                          value={orgSearch}
                          onChange={(e) => setOrgSearch(e.target.value)}
                          className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200"
                        />
                      </div>
                    </div>

                    <div className="max-h-64 overflow-auto border border-gray-200 rounded-xl divide-y">
                      {filteredOrganizations.map(org => (
                        <button
                          key={org.id}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, organization_id: String(org.id) }))}
                          className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors duration-200 ${
                            String(org.id) === String(formData.organization_id) ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-gray-900">{org.name}</span>
                            <span className={`text-xs px-2 py-1 rounded ${
                              String(org.id) === String(formData.organization_id) 
                                ? 'bg-blue-600 text-white' 
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {String(org.id) === String(formData.organization_id) ? 'Selected' : `ID ${org.id}`}
                            </span>
                          </div>
                          {org.email && <p className="text-xs text-gray-600 mt-1">{org.email}</p>}
                        </button>
                      ))}
                      {filteredOrganizations.length === 0 && (
                        <div className="p-4 text-sm text-gray-600 text-center">No organizations found</div>
                      )}
                    </div>
                    
                    <AnimatePresence>
                      {errors.organization_id && (
                        <motion.p 
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -5 }}
                          className="text-red-500 text-sm flex items-center space-x-1"
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>{errors.organization_id}</span>
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}

                {/* Step 5: Review */}
                {currentStep === 5 && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <div className="bg-gray-50 rounded-xl p-6 space-y-3">
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Review Your Information</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Name:</span>
                          <p className="text-gray-900">{formData.name}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Email:</span>
                          <p className="text-gray-900">{formData.email}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Phone:</span>
                          <p className="text-gray-900">{formData.phone}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Country:</span>
                          <p className="text-gray-900">{formData.country}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">City:</span>
                          <p className="text-gray-900">{formData.city}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Address:</span>
                          <p className="text-gray-900">{formData.address}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Postal Code:</span>
                          <p className="text-gray-900">{formData.postal_code}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Organization:</span>
                          <p className="text-gray-900">
                            {organizations.find(o => String(o.id) === String(formData.organization_id))?.name || 'Not selected'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between pt-6">
                  {currentStep > 1 ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={goBack}
                      className="flex items-center space-x-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-all duration-200"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>Back</span>
                    </motion.button>
                  ) : (
                    <div />
                  )}
                  
                  {currentStep < 5 ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={goNext}
                      className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      <span>Next</span>
                      <ArrowRight className="w-4 h-4" />
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      disabled={loading}
                      className="flex items-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl font-semibold hover:from-green-700 hover:to-blue-700 focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Creating Account...</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          <span>Create Account</span>
                        </>
                      )}
                    </motion.button>
                  )}
                </div>
              </form>

              <motion.div 
                variants={itemVariants}
                className="mt-8 text-center"
              >
                <p className="text-sm text-gray-600">
                  Already have a donor account?{' '}
                  <a 
                    href="/donor/login" 
                    className="text-blue-600 hover:text-blue-700 font-semibold hover:underline transition-colors duration-200"
                  >
                    Sign in here
                  </a>
                </p>
              </motion.div>
            </motion.div>
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}