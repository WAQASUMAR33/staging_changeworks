'use client';

import { useState, useEffect, useRef } from 'react';
import { User, LogOut, ChevronDown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const DonorHeader = () => {
  const [user, setUser] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();

  useEffect(() => {
    const userData = localStorage.getItem('user');
    if (userData) {
      setUser(JSON.parse(userData));
    }
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    router.push('/donor/login');
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 px-3 sm:px-6 py-4">
      <div className="flex justify-between items-center">
        {/* Left side - Welcome message */}
        <div className="flex-1 min-w-0">
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-semibold text-gray-800 truncate">
              Welcome back, {user?.name || 'Donor'}!
            </h1>
            <p className="text-xs sm:text-sm text-gray-600 hidden sm:block">
              Manage your donations and track your impact
            </p>
          </div>
        </div>

        {/* Right side - User profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 sm:space-x-3 p-1 rounded-lg hover:bg-gray-100 transition-colors duration-200"
          >
            <div className="w-8 h-8 bg-[#0E0061] rounded-full flex items-center justify-center flex-shrink-0">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-800">{user?.name || 'Donor'}</p>
              <p className="text-xs text-gray-500">{user?.email || 'donor@example.com'}</p>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 hidden md:block" />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
              <Link
                href="/donor/dashboard/profile"
                onClick={() => setDropdownOpen(false)}
                className="flex items-center space-x-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors duration-200"
              >
                <User className="w-4 h-4 text-gray-500" />
                <span>Profile</span>
              </Link>
              <hr className="my-1 border-gray-200" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center space-x-3 px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                <LogOut className="w-4 h-4 text-red-500" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default DonorHeader;
