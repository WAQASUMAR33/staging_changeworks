'use client';

import { useState, useEffect } from 'react';
import { Search, User, Building2 } from 'lucide-react';
import Image from 'next/image';
import { buildOrgLogoUrl } from '@/lib/image-utils';

const DonorHeader = () => {
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [selectedOrganization, setSelectedOrganization] = useState(null);

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    // Check for selected organization in localStorage
    const savedOrg = localStorage.getItem('selectedOrganization');
    if (savedOrg) {
      try {
        setSelectedOrganization(JSON.parse(savedOrg));
      } catch (error) {
        console.error('Error parsing selected organization:', error);
      }
    }

    // Listen for organization selection changes
    const handleStorageChange = (e) => {
      if (e.key === 'selectedOrganization') {
        if (e.newValue) {
          try {
            setSelectedOrganization(JSON.parse(e.newValue));
          } catch (error) {
            console.error('Error parsing selected organization:', error);
          }
        } else {
          setSelectedOrganization(null);
        }
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom events (for same-tab updates)
    const handleOrgChange = (e) => {
      setSelectedOrganization(e.detail);
    };
    
    window.addEventListener('organizationChanged', handleOrgChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('organizationChanged', handleOrgChange);
    };
  }, []);

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-3 sm:px-6 py-4">
      <div className="flex justify-between items-center">
        {/* Left side - Welcome message and selected organization */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-3">
            <div>
              <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800 truncate">
                Welcome back, {user?.name || 'Donor'}!
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
                Manage your donations and track your impact
              </p>
            </div>
            
            {/* Selected Organization */}
            {selectedOrganization && (
              <div className="hidden lg:flex items-center space-x-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-200">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center overflow-hidden">
                  {selectedOrganization.imageUrl ? (
                    <Image
                      src={buildOrgLogoUrl(selectedOrganization.imageUrl)}
                      alt={selectedOrganization.name || 'Organization'}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div 
                    className={`w-full h-full flex items-center justify-center ${selectedOrganization.imageUrl ? 'hidden' : 'flex'}`}
                  >
                    <Building2 className="w-4 h-4 text-blue-600" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {selectedOrganization.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    Selected Organization
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          {/* Search - Hidden on mobile */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all duration-200 w-64"
            />
          </div>

          {/* Mobile search button */}
          <button className="md:hidden p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200">
            <Search className="w-5 h-5" />
          </button>

          {/* Notifications removed */}

          {/* User Profile */}
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#0E0061] rounded-full flex items-center justify-center">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden md:block">
              <p className="text-sm font-medium text-gray-800">{user?.name || 'Donor'}</p>
              <p className="text-xs text-gray-500">{user?.email || 'donor@example.com'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default DonorHeader;
