'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  Eye,
  EyeOff,
  Save,
  Edit3,
  CheckCircle,
  AlertCircle,
  Lock,
  Globe,
  Calendar,
  X,
  Key,
  Camera,
} from 'lucide-react';
import TwoFactorSetup from '@/app/components/TwoFactorSetup';

// Helper function to build organization logo URL
const buildOrgLogoUrl = (imageUrl) => {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('blob:')) return imageUrl; // Handle local preview
  if (imageUrl.startsWith('data:')) return imageUrl; // Handle base64
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) return imageUrl;

  const baseUrl = process.env.NEXT_PUBLIC_IMAGE_BACK_URL;
  if (!baseUrl) return imageUrl;

  const cleanedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanedImageUrl = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;

  return `${cleanedBaseUrl}${cleanedImageUrl}`;
};

const ProfilePage = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPasswordPopup, setShowPasswordPopup] = useState(false);
  const [showEditProfilePopup, setShowEditProfilePopup] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState('');

  // Profile data state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    website: '',
    company: '',
    postalCode: '',
    imageUrl: '',
    createdAt: '',
  });

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    country: '',
    website: '',
    company: '',
    postalCode: '',
    imageUrl: '',
  });

  // Password change form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Password validation errors
  const [passwordErrors, setPasswordErrors] = useState({});

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const token = sessionStorage.getItem('orgToken');
      if (!token) {
        setError('No authentication token found');
        return;
      }

      const response = await fetch('/api/organization/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch profile data');
      }

      const data = await response.json();
      setProfileData(data.organization);
      console.log('Profile Data Fetched:', data.organization);
      setEditForm({
        name: data.organization.name || '',
        phone: data.organization.phone || '',
        address: data.organization.address || '',
        city: data.organization.city || '',
        state: data.organization.state || '',
        country: data.organization.country || '',
        website: data.organization.website || '',
        company: data.organization.company || '',
        postalCode: data.organization.postalCode || '',
        imageUrl: data.organization.imageUrl || '',
      });
      setPreviewUrl(data.organization.imageUrl || '');
      setSelectedFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const convertToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
    });
  };

  const uploadImageToAPI = async (base64Data) => {
    try {
      const rawUrl = process.env.NEXT_PUBLIC_IMAGE_UPLOAD_URL || process.env.IMAGE_UPLOAD_URL || '';
      // Force https — http redirects to https and POST body is lost after the 301
      const apiUrl = rawUrl.replace(/^http:\/\//i, 'https://');
      
      if (!apiUrl) {
        console.warn('Image upload API URL not configured');
        return null;
      }

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Data
        }),
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      console.log('Image upload response:', data);
      return data.image_url;
    } catch (error) {
      console.error('Image upload error:', error);
      throw error;
    }
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file.');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB.');
      return;
    }

    try {
      setError(''); 
      
      // Create local preview
      const localPreview = URL.createObjectURL(file);
      setPreviewUrl(localPreview);
      setSelectedFile(file);
    } catch (err) {
      setError('Failed to process image: ' + err.message);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    try {
      setLoading(true);
      const token = sessionStorage.getItem('orgToken');
      
      let imageUrl = editForm.imageUrl;

      // Upload image if a new file was selected
      if (selectedFile) {
        setUploadingImage(true);
        try {
          const base64Data = await convertToBase64(selectedFile);
          imageUrl = await uploadImageToAPI(base64Data);
          if (!imageUrl) {
            throw new Error('Failed to get image URL from server');
          }
        } catch (uploadError) {
          throw new Error('Image upload failed: ' + uploadError.message);
        } finally {
          setUploadingImage(false);
        }
      }

      const response = await fetch('/api/organization/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editForm,
          imageUrl: imageUrl
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          throw new Error(data.details[0]?.message || 'Failed to update profile');
        }
        throw new Error(data.error || 'Failed to update profile');
      }

      setProfileData(data.organization);
      setSuccess('Profile updated successfully');
      setShowEditProfilePopup(false);

      // Update sessionStorage so the header reflects the new logo immediately
      try {
        const stored = JSON.parse(sessionStorage.getItem('orgUser') || '{}');
        sessionStorage.setItem('orgUser', JSON.stringify({
          ...stored,
          name: data.organization.name || stored.name,
          imageUrl: data.organization.imageUrl || stored.imageUrl,
        }));
        window.dispatchEvent(new CustomEvent('orgUserUpdated'));
      } catch {}

      // Clean up preview URL if it was a blob
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(data.organization.imageUrl || '');
      setEditForm(prev => ({
        ...prev,
        imageUrl: data.organization.imageUrl || ''
      }));

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setPasswordErrors({});

    // Validation
    const errors = {};
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Current password is required';
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'New password is required';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(errors).length > 0) {
      setPasswordErrors(errors);
      return;
    }

    try {
      setLoading(true);
      const token = sessionStorage.getItem('orgToken');
      
      const response = await fetch('/api/organization/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Prefer server-provided validation details when available
        if (data?.details && Array.isArray(data.details)) {
          const first = data.details[0];
          throw new Error(first?.message || data.error || 'Failed to change password');
        }
        throw new Error(data.error || 'Failed to change password');
      }

      setSuccess('Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setShowPasswordPopup(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading && !profileData.name) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="p-6 bg-gray-50 min-h-screen"
    >
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Profile Settings</h1>
          <p className="text-gray-600">Manage your organization profile and security settings</p>
        </motion.div>

        {/* Error/Success Messages */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4"
          >
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <span className="text-red-700">{error}</span>
            </div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4"
          >
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <span className="text-green-700">{success}</span>
            </div>
          </motion.div>
        )}

        {/* Name Card */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mr-6 overflow-hidden">
                {profileData.imageUrl ? (
                  <img
                    src={buildOrgLogoUrl(profileData.imageUrl)}
                    alt={profileData.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-[#0E0061] rounded-full flex items-center justify-center">
                    <Building2 className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">{profileData.name}</h2>
                <p className="text-gray-600 text-lg">{profileData.email}</p>
                <p className="text-sm text-gray-500 mt-1">
                  Member since {formatDate(profileData.createdAt)}
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowEditProfilePopup(true)}
                className="flex items-center space-x-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 focus:ring-offset-2 transition-colors"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => setShowPasswordPopup(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-[#0E0061] text-white rounded-lg hover:bg-[#0C0055] focus:ring-2 focus:ring-[#0E0061] focus:ring-offset-2 transition-colors"
              >
                <Key className="w-4 h-4" />
                <span>Change Password</span>
              </button>
            </div>
          </div>
        </motion.div>

        {/* Basic Information Section */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <User className="w-5 h-5 mr-2 text-blue-600" />
            Basic Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3">
              <User className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Organization Name</p>
                <p className="font-medium text-gray-900">{profileData.name}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Mail className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Email Address</p>
                <p className="font-medium text-gray-900">{profileData.email}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Phone Number</p>
                <p className="font-medium text-gray-900">{profileData.phone || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Globe className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Website</p>
                <p className="font-medium text-gray-900">{profileData.website || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Building2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Company</p>
                <p className="font-medium text-gray-900">{profileData.company || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Calendar className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">GHL ID</p>
                <p className="font-medium text-gray-900">{profileData.ghlId || 'Not provided'}</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Location Information Section */}
        <motion.div
          variants={itemVariants}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6"
        >
          <h3 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <MapPin className="w-5 h-5 mr-2 text-green-600" />
            Location Information
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Address</p>
                <p className="font-medium text-gray-900">{profileData.address || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Building2 className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">City</p>
                <p className="font-medium text-gray-900">{profileData.city || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">State</p>
                <p className="font-medium text-gray-900">{profileData.state || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Country</p>
                <p className="font-medium text-gray-900">{profileData.country || 'Not provided'}</p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <MapPin className="w-5 h-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Postal Code</p>
                <p className="font-medium text-gray-900">{profileData.postalCode || 'Not provided'}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Edit Profile Popup */}
      <AnimatePresence>
        {showEditProfilePopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setShowEditProfilePopup(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                    <Edit3 className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Edit Profile</h3>
                    <p className="text-sm text-gray-600">Update your organization information</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditProfilePopup(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateProfile} className="space-y-6">
                {/* Profile Image Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Profile Image
                  </label>
                  <div className="flex items-start space-x-4">
                    <div className="w-20 h-20 rounded-full bg-gray-100 flex-shrink-0 overflow-hidden border border-gray-200 relative">
                      {previewUrl ? (
                        <img src={buildOrgLogoUrl(previewUrl)} alt="Preview" className="w-full h-full object-contain" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Camera className="w-8 h-8 text-gray-400" />
                        </div>
                      )}
                      {uploadingImage && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="block w-full">
                        <span className="sr-only">Choose profile photo</span>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleImageChange}
                          disabled={uploadingImage}
                          className="block w-full text-sm text-gray-500
                            file:mr-4 file:py-2 file:px-4
                            file:rounded-full file:border-0
                            file:text-sm file:font-semibold
                            file:bg-blue-50 file:text-blue-700
                            hover:file:bg-blue-100
                            disabled:opacity-50 disabled:cursor-not-allowed
                          "
                        />
                      </label>
                      <p className="mt-1 text-xs text-gray-500">
                        PNG, JPG or GIF (MAX. 5MB)
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Organization Name
                    </label>
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                      required
                    />
                  </div>

                  {/* Company */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name
                    </label>
                    <input
                      type="text"
                      value={editForm.company}
                      onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      value={editForm.phone}
                      onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  {/* Website */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Website
                    </label>
                    <input
                      type="text"
                      value={editForm.website}
                      onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address
                    </label>
                    <input
                      type="text"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      City
                    </label>
                    <input
                      type="text"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  {/* State */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      State
                    </label>
                    <input
                      type="text"
                      value={editForm.state}
                      onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  {/* Country */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Country
                    </label>
                    <input
                      type="text"
                      value={editForm.country}
                      onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>

                  {/* Postal Code */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Postal Code
                    </label>
                    <input
                      type="text"
                      value={editForm.postalCode}
                      onChange={(e) => setEditForm({ ...editForm, postalCode: e.target.value })}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900"
                    />
                  </div>
                </div>

                <div className="flex space-x-3 pt-4 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowEditProfilePopup(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading || uploadingImage}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-[#0E0061] text-white rounded-lg hover:bg-[#0C0055] focus:ring-2 focus:ring-[#0E0061] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading || uploadingImage ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{loading ? 'Saving...' : uploadingImage ? 'Uploading...' : 'Save Changes'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Change Popup */}
      <AnimatePresence>
        {showPasswordPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            {/* Backdrop with blur */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/30 backdrop-blur-sm"
              onClick={() => setShowPasswordPopup(false)}
            />
            
            {/* Popup Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-xl shadow-2xl p-6 w-full max-w-md"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center mr-3">
                    <Lock className="w-5 h-5 text-red-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">Change Password</h3>
                    <p className="text-sm text-gray-600">Update your account password</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordPopup(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form */}
              <form onSubmit={handlePasswordChange} className="space-y-4">
                {/* Current Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Current Password
                  </label>
                  <div className="relative">
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                        passwordErrors.currentPassword ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your current password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordErrors.currentPassword && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.currentPassword}</p>
                  )}
                </div>

                {/* New Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                        passwordErrors.newPassword ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter your new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordErrors.newPassword && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.newPassword}</p>
                  )}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 ${
                        passwordErrors.confirmPassword ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Confirm your new password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                  {passwordErrors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{passwordErrors.confirmPassword}</p>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowPasswordPopup(false)}
                    className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 flex items-center justify-center space-x-2 px-4 py-3 bg-[#0E0061] text-white rounded-lg hover:bg-[#0C0055] focus:ring-2 focus:ring-[#0E0061] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    <span>{loading ? 'Updating...' : 'Update'}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Two-Factor Authentication Section */}
      <motion.div variants={itemVariants} className="mt-6">
        <TwoFactorSetup userType="organization" />
      </motion.div>
    </motion.div>
  );
};

export default ProfilePage;
