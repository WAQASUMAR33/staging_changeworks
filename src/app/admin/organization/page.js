'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import {
  Box,
  TextField,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Alert,
  Button,
  IconButton,
  CircularProgress,
  FormControlLabel,
  Checkbox,
  TablePagination,
} from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Edit, Trash2, Package, Plus } from 'lucide-react';

// Helper function to format dates consistently
const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toISOString().split('T')[0]; // Convert to YYYY-MM-DD
};

// Helper function to build organization logo URL
const buildOrgLogoUrl = (imageUrl) => {
  if (!imageUrl) return null;
  
  // If it's already a full URL, return as-is
  if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
    return imageUrl;
  }
  
  // Use the environment variable for the base URL
  const baseUrl = process.env.NEXT_PUBLIC_IMAGE_BACK_URL;
  if (!baseUrl) {
    console.warn('NEXT_PUBLIC_IMAGE_BACK_URL is not set. Cannot build image URL.');
    return imageUrl; // Fallback to original imageUrl if base URL is not configured
  }
  
  // Ensure the base URL ends with a slash and the image URL doesn't start with one
  const cleanedBaseUrl = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const cleanedImageUrl = imageUrl.startsWith('/') ? imageUrl.substring(1) : imageUrl;
  
  return `${cleanedBaseUrl}${cleanedImageUrl}`;
};

const convertToBase64 = (file) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
  });
};

const uploadImageToServer = async (base64Image) => {
  try {
    const uploadApiUrl = process.env.NEXT_PUBLIC_IMAGE_UPLOAD_API || '/api/upload-image';
    const response = await fetch(uploadApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: base64Image }),
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Image upload failed: HTTP ${response.status}`);
    }
    const data = JSON.parse(text);
    if (!data.image_url) {
      throw new Error('No image URL returned from server');
    }
    const fullPath = `${process.env.NEXT_PUBLIC_IMAGE_UPLOAD_PATH || ''}/${data.image_url}`;
    if (!/^https?:\/\/.+/.test(fullPath)) {
      throw new Error('Invalid image URL returned from server');
    }
    return fullPath;
  } catch (error) {
    throw error;
  }
};

export default function OrganizationManagementPage() {
  const [organizations, setOrganizations] = useState([]);
  const [filteredOrganizations, setFilteredOrganizations] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('view'); // 'view', 'add', 'edit', 'delete'
  const [selectedOrganization, setSelectedOrganization] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    company: '',
    address: '',
    website: '',
    city: '',
    state: '',
    country: '',
    postalCode: '',
    ghlId: '',
    imageUrl: '',
    status: true,
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [error, setError] = useState('');
  // Pagination states
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  // Filter states
  const [filterName, setFilterName] = useState('');
  const [filterEmail, setFilterEmail] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Fetch organizations on mount and when page/rowsPerPage change
  useEffect(() => {
    fetchOrganizations();
  }, [page, rowsPerPage, fetchOrganizations]);

  // Apply filters
  useEffect(() => {
    const filtered = organizations.filter((org) => {
      const matchesName = org.name.toLowerCase().includes(filterName.toLowerCase());
      const matchesEmail = org.email.toLowerCase().includes(filterEmail.toLowerCase());
      const matchesCity = org.city ? org.city.toLowerCase().includes(filterCity.toLowerCase()) : true;
      const matchesStatus = filterStatus !== '' ? org.status === (filterStatus === 'true') : true;
      return matchesName && matchesEmail && matchesCity && matchesStatus;
    });
    setFilteredOrganizations(filtered);
  }, [organizations, filterName, filterEmail, filterCity, filterStatus]);

  const fetchOrganizations = useCallback(async () => {
    try {
      const response = await fetch(`/api/admin/organizations?page=${page + 1}&limit=${rowsPerPage}`);
      const data = await response.json();
      console.log('API Response:', data);
      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}: Failed to fetch organizations`);
      }
      if (!data.success || !Array.isArray(data.organizations)) {
        console.error('Unexpected response format:', data);
        throw new Error('Expected organizations data to be an array');
      }
      setOrganizations(data.organizations);
      setTotalCount(data.totalCount || 0);
      setLoading(false);
    } catch (err) {
      setError(`Failed to load organizations: ${err.message}`);
      setOrganizations([]);
      setTotalCount(0);
      setLoading(false);
      console.error('Fetch error:', err);
    }
  }, [page, rowsPerPage]);

  const handleModalOpen = (mode, org = null) => {
    setModalMode(mode);
    setSelectedOrganization(org);
    if (mode === 'view' || mode === 'edit') {
      setFormData({
        name: org?.name || '',
        email: org?.email || '',
        password: '',
        phone: org?.phone || '',
        company: org?.company || '',
        address: org?.address || '',
        website: org?.website || '',
        city: org?.city || '',
        state: org?.state || '',
        country: org?.country || '',
        postalCode: org?.postalCode || '',
        ghlId: org?.ghlId || '',
        imageUrl: org?.imageUrl || '',
        status: org?.status !== undefined ? org.status : true,
      });
      setImagePreview(org?.imageUrl || '');
    } else if (mode === 'add') {
      setFormData({
        name: '',
        email: '',
        password: '',
        phone: '',
        company: '',
        address: '',
        website: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        ghlId: '',
        imageUrl: '',
        status: true,
      });
      setImagePreview('');
    }
    setImageFile(null);
    setError('');
    setModalOpen(true);
  };

  const handleModalClose = () => {
    setModalOpen(false);
    setSelectedOrganization(null);
    setImageFile(null);
    setImagePreview('');
    setError('');
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        setImageFile(file);
        const base64 = await convertToBase64(file);
        setImagePreview(base64);
        setFormData({ ...formData, imageUrl: '' });
      } catch (error) {
        setError('Failed to process image');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const { name, email, password, phone, company, address, website, city, state, country, postalCode, ghlId, status } = formData;
    if (modalMode === 'add' || modalMode === 'edit') {
      if (!name || !email || (modalMode === 'add' && !password)) {
        setError('Name, email, and password (for new organizations) are required');
        return;
      }
    }

    try {
      let imageUrl = formData.imageUrl;
      if (imageFile) {
        const base64Image = await convertToBase64(imageFile);
        imageUrl = await uploadImageToServer(base64Image);
      }

      let response;
      if (modalMode === 'add') {
        const payload = {
          name,
          email,
          password,
          phone: phone || null,
          company: company || null,
          address: address || null,
          website: website || null,
          city: city || null,
          state: state || null,
          country: country || null,
          postalCode: postalCode || null,
          ghlId: ghlId || null,
          imageUrl: imageUrl || null,
          status,
        };
        response = await fetch('/api/organization', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else if (modalMode === 'edit' && selectedOrganization) {
        const payload = {
          name,
          email,
          phone: phone || null,
          company: company || null,
          address: address || null,
          website: website || null,
          city: city || null,
          state: state || null,
          country: country || null,
          postalCode: postalCode || null,
          ghlId: ghlId || null,
          imageUrl: imageUrl || selectedOrganization.imageUrl || null,
          status,
        };
        response = await fetch(`/api/organization/${selectedOrganization.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
      } else if (modalMode === 'delete' && selectedOrganization) {
        response = await fetch(`/api/organization/${selectedOrganization.id}`, {
          method: 'DELETE',
        });
      }

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}: Operation failed`);

      setPage(0);
      await fetchOrganizations();
      handleModalClose();
    } catch (err) {
      setError(`Operation failed: ${err.message}`);
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
  const handleFilterNameChange = (e) => setFilterName(e.target.value);
  const handleFilterEmailChange = (e) => setFilterEmail(e.target.value);
  const handleFilterCityChange = (e) => setFilterCity(e.target.value);
  const handleFilterStatusChange = (e) => setFilterStatus(e.target.value);

  // Animation variants
  const tableRowVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const modalVariants = {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1 },
    exit: { opacity: 0, scale: 0.8 },
  };

  const filterVariants = {
    hidden: { opacity: 0, y: -20 },
    visible: { opacity: 1, y: 0 },
  };

  // Permission flags (simplified for organizations)
  const hasAnyActionPermission = true; // Adjust based on your auth logic
  const canEdit = true;
  const canDelete = true;
  const canCreate = true;

  const getStatusText = (status) => {
    return status ? 'Active' : 'Inactive';
  };

  return (
    <Box sx={{ bgcolor: '#FFF', minHeight: '100vh' }}>
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">Organization Management</h2>
        {canCreate && (
          <button
            onClick={() => handleModalOpen('add')}
            className="inline-flex items-center gap-2 bg-[#0E0061] text-white px-4 py-2 rounded-lg hover:bg-[#0C0055] transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add New Organization
          </button>
        )}
      </div>

      {/* Filters */}
      <motion.div
        variants={filterVariants}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.5 }}
        className="mb-6 flex gap-4 flex-wrap"
      >
        <TextField
          label="Filter by Name"
          value={filterName}
          onChange={handleFilterNameChange}
          variant="outlined"
          size="small"
          className="min-w-[200px]"
          sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
        />
        <TextField
          label="Filter by Email"
          value={filterEmail}
          onChange={handleFilterEmailChange}
          variant="outlined"
          size="small"
          className="min-w-[200px]"
          sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
        />
        <TextField
          label="Filter by City"
          value={filterCity}
          onChange={handleFilterCityChange}
          variant="outlined"
          size="small"
          className="min-w-[200px]"
          sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
        />
        <FormControl className="min-w-[200px]" size="small">
          <InputLabel>Filter by Status</InputLabel>
          <Select
            value={filterStatus}
            onChange={handleFilterStatusChange}
            label="Filter by Status"
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">Active</MenuItem>
            <MenuItem value="false">Inactive</MenuItem>
          </Select>
        </FormControl>
      </motion.div>

      {error && (
        <div className="mb-6">
          <Alert
            severity="error"
            action={
              <Button color="inherit" size="small" onClick={fetchOrganizations}>
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
                    Name
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Website
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Image
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created At
                  </th>
                  {hasAnyActionPermission && (
                    <th className="px-6 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                <AnimatePresence>
                  {filteredOrganizations.map((org, index) => (
                    <motion.tr
                      key={org.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ delay: index * 0.05 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          {org.imageUrl && (
                            <Image
                              src={buildOrgLogoUrl(org.imageUrl)}
                              alt={org.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-lg object-cover mr-3"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900">{org.name}</div>
                            <div className="text-sm text-gray-500">{org.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{org.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{org.phone || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{org.company || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {org.website ? (
                            <a
                              href={org.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              {org.website}
                            </a>
                          ) : (
                            'N/A'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {org.imageUrl ? (
                            <Image
                              src={buildOrgLogoUrl(org.imageUrl)}
                              alt={org.name}
                              width={40}
                              height={40}
                              className="w-10 h-10 rounded-lg object-cover"
                              onError={(e) => {
                                e.target.style.display = 'none';
                              }}
                            />
                          ) : (
                            'No Image'
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            org.status ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {getStatusText(org.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{formatDate(org.created_at)}</div>
                      </td>
                      {hasAnyActionPermission && (
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleModalOpen('view', org)}
                              className="text-blue-600 hover:text-blue-900 p-1 hover:bg-blue-50 rounded"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            {canEdit && (
                              <button
                                onClick={() => handleModalOpen('edit', org)}
                                className="text-green-600 hover:text-green-900 p-1 hover:bg-green-50 rounded"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                onClick={() => handleModalOpen('delete', org)}
                                className="text-red-600 hover:text-red-900 p-1 hover:bg-red-50 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {filteredOrganizations.length === 0 && (
            <div className="text-center py-12">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No organizations found</h3>
              <p className="text-gray-500 mb-4">Get started by creating your first organization.</p>
              {canCreate && (
                <button
                  onClick={() => handleModalOpen('add')}
                  className="inline-flex items-center gap-2 bg-[#0E0061] text-white px-4 py-2 rounded-lg hover:bg-[#0C0055] transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Add New Organization
                </button>
              )}
            </div>
          )}

          {filteredOrganizations.length > 0 && (
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

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <Dialog
            open={modalOpen}
            onClose={handleModalClose}
            maxWidth="sm"
            fullWidth
            component={motion.div}
            variants={modalVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={{ duration: 0.3 }}
          >
            <DialogTitle sx={{ bgcolor: '#1a3c34', color: 'white', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {modalMode === 'add' ? 'Add Organization' : modalMode === 'edit' ? 'Edit Organization' : modalMode === 'view' ? 'View Organization' : 'Delete Organization'}
              <IconButton onClick={handleModalClose} sx={{ color: 'white' }}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              {modalMode !== 'delete' ? (
                <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                  <TextField
                    label="Name"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="Email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    required
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  {modalMode === 'add' && (
                    <TextField
                      label="Password"
                      name="password"
                      type="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      fullWidth
                      margin="normal"
                      required
                      sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                    />
                  )}
                  <TextField
                    label="Phone"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="Company"
                    name="company"
                    value={formData.company}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="Website"
                    name="website"
                    value={formData.website}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="Address"
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    multiline
                    rows={2}
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="City"
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="State"
                    name="state"
                    value={formData.state}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="Country"
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="Postal Code"
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  <TextField
                    label="GHL ID"
                    name="ghlId"
                    value={formData.ghlId}
                    onChange={handleInputChange}
                    fullWidth
                    margin="normal"
                    disabled={modalMode === 'view'}
                    sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                  />
                  {modalMode !== 'view' && (
                    <TextField
                      type="file"
                      label="Organization Image"
                      InputLabelProps={{ shrink: true }}
                      name="image"
                      onChange={handleImageChange}
                      fullWidth
                      margin="normal"
                      inputProps={{ accept: 'image/*' }}
                      sx={{ '& .MuiInputBase-input': { color: '#111827' } }}
                    />
                  )}
                  {(imagePreview || formData.imageUrl) && (
                    <Box sx={{ mt: 2 }}>
                      <span className="text-sm text-gray-500">Image Preview:</span>
                      <Image
                        src={imagePreview || buildOrgLogoUrl(formData.imageUrl)}
                        alt="Organization preview"
                        width={80}
                        height={80}
                        className="h-20 w-20 object-cover rounded-lg mt-2"
                      />
                    </Box>
                  )}
                  <FormControlLabel
                    control={
                      <Checkbox
                        name="status"
                        checked={formData.status}
                        onChange={handleInputChange}
                        color="success"
                        disabled={modalMode === 'view'}
                      />
                    }
                    label="Active"
                    sx={{ mt: 2 }}
                  />
                  {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
                </Box>
              ) : (
                <span className="text-gray-900">
                  Are you sure you want to delete organization <strong>{selectedOrganization?.name}</strong>?
                </span>
              )}
            </DialogContent>
            <DialogActions>
              <Button onClick={handleModalClose} color="inherit">
                Cancel
              </Button>
              {modalMode === 'view' ? null : modalMode !== 'delete' ? (
                <Button
                  type="submit"
                  variant="contained"
                  color="success"
                  onClick={handleSubmit}
                  sx={{ borderRadius: '20px', textTransform: 'none' }}
                >
                  {modalMode === 'add' ? 'Add' : 'Update'}
                </Button>
              ) : (
                <Button
                  variant="contained"
                  color="error"
                  onClick={handleSubmit}
                  sx={{ borderRadius: '20px', textTransform: 'none' }}
                >
                  Delete
                </Button>
              )}
            </DialogActions>
          </Dialog>
        )}
      </AnimatePresence>
    </Box>
  );
}