'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
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
  Shield,
  FileText,
  Banknote,
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
      name: 'Monthly Donations',
      icon: CreditCard,
      path: '/donor/dashboard/subscriptions',
    },
  ];

  const SidebarContent = ({ onMobileClose }) => (
    <div className="flex flex-col h-full min-h-screen">
      {/* Mobile close button */}
      {onMobileClose && (
        <div className="flex justify-end p-2 lg:hidden">
          <button
            onClick={onMobileClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      )}

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
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-600'}`} />
              {isExpanded && (
                <span className="font-medium truncate">{item.name}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Logout Button - Sticky to bottom */}
      <div className="p-4 border-t border-gray-200 flex-shrink-0 mt-auto">
        <div className="space-y-1 mb-2">
          <Link
            href="https://changeworksfund.org/privacy-policy"
            target="_blank"
            className="w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 group"
          >
            <Shield className="w-5 h-5 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
            {isExpanded && (
              <span className="font-medium truncate">Privacy Policy</span>
            )}
          </Link>

          <Link
            href="https://changeworksfund.org/terms-conditions"
            target="_blank"
            className="w-full flex items-center space-x-3 px-3 py-3 rounded-xl text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-all duration-200 group"
          >
            <FileText className="w-5 h-5 flex-shrink-0 text-gray-400 group-hover:text-gray-600" />
            {isExpanded && (
              <span className="font-medium truncate">Terms & Conditions</span>
            )}
          </Link>
        </div>

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
