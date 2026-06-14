'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { buildOrgLogoUrl } from '@/lib/image-utils';
import {
  LayoutDashboard,
  User,
  Heart,
  CreditCard,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Gift,
  Bell,
  Pin,
  PinOff,
  Menu,
  X,
  Building2,
} from 'lucide-react';

const DonorSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    // Check localStorage for saved preference, default to true (always open)
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('sidebar-pinned');
      return saved !== null ? JSON.parse(saved) : true;
    }
    return true;
  });
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [selectedOrganization, setSelectedOrganization] = useState(null);

  useEffect(() => {
    // Load user data
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }

    // Load selected organization
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

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    router.push('/donor/login');
  };

  const isExpanded = isHovered || isPinned;

  const menuItems = [
    {
      name: 'Dashboard',
      icon: LayoutDashboard,
      path: '/donor/dashboard',
    },
    {
      name: 'My Donations',
      icon: Heart,
      path: '/donor/dashboard/donations',
    },
    {
      name: 'Recurring Donations',
      icon: CreditCard,
      path: '/donor/dashboard/subscriptions',
    },
    {
      name: 'Profile',
      icon: User,
      path: '/donor/dashboard/profile',
    },
  ];

  const SidebarContent = ({ onMobileClose }) => (
    <div className="flex flex-col h-full min-h-screen">
      {/* Header with Organization Logo, Donor Info, and Pin/Close */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
        {/* Organization Logo and Donor Info */}
        {isExpanded && (
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            {/* Organization Image */}
            {selectedOrganization && (
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0">
                {selectedOrganization.imageUrl ? (
                  <Image
                    src={buildOrgLogoUrl(selectedOrganization.imageUrl)}
                    alt={selectedOrganization.name || 'Organization'}
                    width={40}
                    height={40}
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
                  <Building2 className="w-5 h-5 text-gray-600" />
                </div>
              </div>
            )}

            {/* Donor Name */}
            {user && (
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-gray-800 truncate">{user.name}</h2>
                <p className="text-xs text-gray-500">Donor</p>
              </div>
            )}
          </div>
        )}

        {/* Pin/Close buttons */}
        <div className="flex items-center space-x-2">
          {/* Mobile close button */}
          {onMobileClose && (
            <button
              onClick={onMobileClose}
              className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200 lg:hidden"
            >
              <X className="w-4 h-4 text-gray-600" />
            </button>
          )}
          {/* Desktop pin button */}
          <button
            onClick={() => {
              const newPinnedState = !isPinned;
              setIsPinned(newPinnedState);
              localStorage.setItem('sidebar-pinned', JSON.stringify(newPinnedState));
            }}
            className="hidden lg:block p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            {isPinned ? (
              <Pin className="w-4 h-4 text-gray-600" />
            ) : (
              <PinOff className="w-4 h-4 text-gray-400" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
        {menuItems.map((item) => {
          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <button
              key={item.path}
              onClick={() => {
                router.push(item.path);
                if (onMobileClose) onMobileClose();
              }}
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-200 group ${isActive
                ? 'bg-[#0E0061] text-white shadow-lg'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
              {isExpanded && (
                <span className="font-medium">{item.name}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout Button - Sticky to bottom */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0 mt-auto">
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-red-600 hover:bg-red-50 transition-all duration-200 group"
        >
          <LogOut className="w-5 h-5 text-red-500" />
          {isExpanded && (
            <span className="font-medium">Logout</span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Sidebar */}
      <div className="lg:hidden">
        {/* Mobile menu button */}
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-lg lg:hidden"
        >
          {isMobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>

        {/* Mobile overlay */}
        {isMobileOpen && (
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setIsMobileOpen(false)}
          />
        )}

        {/* Mobile sidebar */}
        <div
          className={`fixed top-0 left-0 h-full bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'
            } w-64`}
        >
          <SidebarContent onMobileClose={() => setIsMobileOpen(false)} />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:block bg-white shadow-lg transition-all duration-300 ease-in-out h-screen ${isExpanded ? 'w-64' : 'w-16'
          }`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <SidebarContent />
      </div>
    </>
  );
};

export default DonorSidebar;
