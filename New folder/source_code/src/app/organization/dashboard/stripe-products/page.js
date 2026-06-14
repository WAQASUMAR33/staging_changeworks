'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, DollarSign, RefreshCw, AlertCircle, CheckCircle, Package, ExternalLink, Copy, Check } from 'lucide-react';

export default function StripeProductsPage() {
  const router = useRouter();
  const [organization, setOrganization] = useState(null);
  const [products, setProducts] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [customProducts, setCustomProducts] = useState([
    { name: '', price: 0 },
    { name: '', price: 0 },
    { name: '', price: 0 }
  ]);
  const [stripeProductDetails, setStripeProductDetails] = useState([]);

  useEffect(() => {
    // Get organization from session
    const orgUser = sessionStorage.getItem('orgUser');
    if (orgUser) {
      const org = JSON.parse(orgUser);
      // We'll set the initial organization but fetch fresh data including stripeAccountId
      fetchProducts(org.id);
    }
  }, []);

  const fetchProducts = async (orgId) => {
    try {
      setLoading(true);
      setError('');

      const token = sessionStorage.getItem('orgToken');
      const response = await fetch(`/api/organization/${orgId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const data = await response.json();

      if (response.ok && data.organization) {
        const org = data.organization;
        setOrganization(org);
        setProducts({
          product1: org.stripeProductId1,
          product2: org.stripeProductId2,
          product3: org.stripeProductId3
        });

        // Fetch product details with prices from Stripe
        if (org.stripeProductId1 || org.stripeProductId2 || org.stripeProductId3) {
          await fetchProductDetails(orgId);
        }
      }
    } catch (err) {
      console.error('Error fetching products:', err);
      setError('Failed to load Stripe products');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductDetails = async (orgId) => {
    try {
      const response = await fetch(`/api/stripe/organization-products?organization_id=${orgId}`);
      const data = await response.json();

      if (data.success && data.products) {
        setStripeProductDetails(data.products);
      }
    } catch (err) {
      console.error('Error fetching product details:', err);
    }
  };

  const createProducts = async (force = false) => {
    try {
      setCreating(true);
      setError('');
      setSuccess('');

      const token = sessionStorage.getItem('orgToken');
      const response = await fetch('/api/organization/create-stripe-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          organization_id: organization.id,
          products: customProducts,
          force
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create products');
      }

      setSuccess('Stripe products created successfully!');
      setProducts({
        product1: data.stripeProductId1,
        product2: data.stripeProductId2,
        product3: data.stripeProductId3
      });

      // Refresh after 2 seconds
      setTimeout(() => {
        fetchProducts(organization.id);
      }, 2000);

    } catch (err) {
      console.error('Error creating products:', err);
      setError(err.message || 'Failed to create Stripe products');
    } finally {
      setCreating(false);
    }
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(''), 2000);
  };

  const productDetails = [
    {
      id: 'product1',
      name: 'Package 1',
      description: 'First donation package',
      icon: DollarSign,
      color: 'blue',
      stripeId: products?.product1
    },
    {
      id: 'product2',
      name: 'Package 2',
      description: 'Second donation package',
      icon: RefreshCw,
      color: 'green',
      stripeId: products?.product2
    },
    {
      id: 'product3',
      name: 'Package 3',
      description: 'Third donation package',
      icon: Package,
      color: 'purple',
      stripeId: products?.product3
    }
  ];

  const hasProducts = products && (products.product1 || products.product2 || products.product3);
  const allProductsCreated = products && products.product1 && products.product2 && products.product3;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Stripe products...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Stripe Products</h1>
            <p className="text-gray-600">
              Manage your organization&apos;s Stripe products for donations
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {allProductsCreated && organization?.stripeAccountId && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => createProducts(true)}
                disabled={creating}
                className="px-6 py-3 bg-white text-blue-600 border-2 border-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-colors disabled:opacity-50 flex items-center space-x-2"
              >
                <RefreshCw className={`w-5 h-5 ${creating ? 'animate-spin' : ''}`} />
                <span>Update to Recurring</span>
              </motion.button>
            )}

            {!allProductsCreated && organization?.stripeAccountId && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => createProducts(false)}
                disabled={creating}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-lg"
              >
                {creating ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span>Creating...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>Create Products</span>
                  </>
                )}
              </motion.button>
            )}
          </div>
        </div>
      </div>

      {/* Alerts */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center space-x-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
            <p className="text-red-700">{error}</p>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center space-x-3"
          >
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-green-700">{success}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Status Banner */}
      {!organization?.stripeAccountId ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-6 bg-red-50 border-2 border-red-200 rounded-2xl"
        >
          <div className="flex items-start space-x-4">
            <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
            <div>
              <h3 className="text-lg font-bold text-red-900 mb-2">
                Stripe is not connected
              </h3>
              <p className="text-red-800 mb-4">
                Your organization is not yet connected to Stripe. You must complete your Stripe integration
                before you can create donation products.
              </p>
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => router.push('/organization/dashboard/settings/profile')}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  Go to Settings
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : !hasProducts && (
        <div className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-2xl"
          >
            <div className="flex items-start space-x-4">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-yellow-900 mb-2">
                  Configure Your Donation Packages
                </h3>
                <p className="text-yellow-800 mb-4">
                  Set up your 3 donation products below. Once you click &quot;Create Products&quot;, they will be
                  automatically configured in your Stripe account.
                </p>
              </div>
            </div>

            {/* Custom Products Form */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
              {customProducts.map((product, index) => (
                <div key={index} className="bg-white p-5 rounded-xl border border-yellow-200 shadow-sm">
                  <h4 className="font-bold text-gray-900 mb-4 flex items-center">
                    <Package className="w-4 h-4 mr-2 text-blue-600" />
                    Package {index + 1}
                  </h4>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        Product Name
                      </label>
                      <input
                        type="text"
                        value={product.name}
                        onChange={(e) => {
                          const newProducts = [...customProducts];
                          newProducts[index].name = e.target.value;
                          setCustomProducts(newProducts);
                        }}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        placeholder="e.g. Silver Plan"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">
                        Price (USD)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">$</span>
                        <input
                          type="number"
                          value={product.price}
                          onChange={(e) => {
                            const newProducts = [...customProducts];
                            newProducts[index].price = parseFloat(e.target.value) || 0;
                            setCustomProducts(newProducts);
                          }}
                          className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm text-black focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-end">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => createProducts(false)}
                disabled={creating}
                className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center space-x-2 shadow-lg hover:shadow-blue-200"
              >
                {creating ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>Creating in Stripe...</span>
                  </>
                ) : (
                  <>
                    <CreditCard className="w-5 h-5" />
                    <span>Create Products Now</span>
                  </>
                )}
              </motion.button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {productDetails.map((product, index) => {
          const Icon = product.icon;
          const hasProduct = !!product.stripeId;
          const colorClasses = {
            blue: 'bg-blue-100 text-blue-600 border-blue-200',
            green: 'bg-green-100 text-green-600 border-green-200',
            purple: 'bg-purple-100 text-purple-600 border-purple-200'
          };

          return (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`relative p-6 rounded-2xl border-2 shadow-lg transition-all ${hasProduct
                ? 'bg-white border-gray-200 hover:shadow-xl'
                : 'bg-gray-50 border-gray-300 opacity-60'
                }`}
            >
              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                {hasProduct ? (
                  <span className="px-3 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    Active
                  </span>
                ) : (
                  <span className="px-3 py-1 bg-gray-200 text-gray-600 text-xs font-semibold rounded-full">
                    Not Created
                  </span>
                )}
              </div>

              {/* Icon */}
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-4 ${colorClasses[product.color]}`}>
                <Icon className="w-7 h-7" />
              </div>

              {/* Product Info */}
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {product.name}
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                {product.description}
              </p>

              {/* Price */}
              <div className="mb-4">
                <span className="text-xs text-gray-500">Price (USD)</span>
                <p className="text-2xl font-bold text-gray-900">
                  {(() => {
                    const stripeProduct = stripeProductDetails.find(p => p.id === product.stripeId);
                    if (stripeProduct && stripeProduct.price) {
                      const amount = stripeProduct.price.unit_amount / 100;
                      return `$${amount.toFixed(2)}`;
                    }
                    return '---';
                  })()}
                </p>
              </div>

              {/* Product ID */}
              {hasProduct && (
                <div className="space-y-2">
                  <span className="text-xs text-gray-500">Product ID</span>
                  <div className="flex items-center space-x-2">
                    <code className="flex-1 text-xs bg-gray-100 px-3 py-2 rounded-lg font-mono text-gray-700 truncate">
                      {product.stripeId}
                    </code>
                    <button
                      onClick={() => copyToClipboard(product.stripeId, product.id)}
                      className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Copy to clipboard"
                    >
                      {copiedId === product.id ? (
                        <Check className="w-4 h-4 text-green-600" />
                      ) : (
                        <Copy className="w-4 h-4 text-gray-600" />
                      )}
                    </button>
                  </div>

                  {/* View in Stripe */}
                  <a
                    href={`https://dashboard.stripe.com/products/${product.stripeId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 text-sm text-blue-600 hover:text-blue-700 hover:underline mt-2"
                  >
                    <span>View in Stripe</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Info Section */}
      {allProductsCreated && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-2xl"
        >
          <h3 className="text-lg font-bold text-blue-900 mb-3">
            âœ… All Products Created
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>
              â€¢ Your Stripe products are set up and ready to accept donations
            </p>
            <p>
              â€¢ These products will be used automatically when donors make contributions
            </p>
            <p>
              â€¢ You can view and manage them in your Stripe Dashboard
            </p>
          </div>
        </motion.div>
      )}
    </div>
  );
}



