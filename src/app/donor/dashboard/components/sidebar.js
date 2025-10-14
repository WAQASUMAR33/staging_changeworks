'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
      {/* Logo and Toggle */}
      <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
        {isExpanded && (
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-[#0E0061] rounded-lg flex items-center justify-center">
              <Gift className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-800">Donor Portal</h2>
              <p className="text-xs text-gray-500">ChangeWorks Fund</p>
            </div>
          </div>
        )}
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
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-xl transition-all duration-200 group ${
                isActive
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
          className={`fixed top-0 left-0 h-full bg-white shadow-lg z-50 transform transition-transform duration-300 ease-in-out lg:hidden ${
            isMobileOpen ? 'translate-x-0' : '-translate-x-full'
          } w-64`}
        >
          <SidebarContent onMobileClose={() => setIsMobileOpen(false)} />
        </div>
      </div>

      {/* Desktop Sidebar */}
      <div
        className={`hidden lg:block bg-white shadow-lg transition-all duration-300 ease-in-out h-screen ${
          isExpanded ? 'w-64' : 'w-16'
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
