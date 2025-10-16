'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from './components/sidebar';
import Header from './components/header';

export default function AdminLayout({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  useEffect(() => {
    // Skip authentication check for login page to prevent infinite loop
    if (pathname === '/admin/secure-portal') {
      setIsAdmin(false);
      setIsLoading(false);
      return;
    }

    // Check if user has admin token or is an admin user
    const adminToken = localStorage.getItem('adminToken');
    const adminUser = localStorage.getItem('adminUser');
    const regularToken = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    console.log('🔍 Admin Layout - Authentication check:', {
      pathname,
      adminToken: !!adminToken,
      adminUser: !!adminUser,
      regularToken: !!regularToken,
      user: !!user,
      adminUserData: adminUser ? JSON.parse(adminUser) : null,
      userData: user ? JSON.parse(user) : null
    });
    
    // Check if user is admin through admin token
    if (adminToken && adminUser) {
      console.log('✅ Admin Layout - Admin token found, setting isAdmin to true');
      setIsAdmin(true);
      setIsLoading(false);
      return;
    }
    
    // Check if user is admin through regular token
    if (regularToken && user) {
      try {
        const userData = JSON.parse(user);
        if (userData.role === 'ADMIN' || userData.role === 'SUPERADMIN' || userData.role === 'MANAGER') {
          console.log('✅ Admin Layout - Regular token with admin role found, converting to admin token');
          // Convert regular token to admin token
          localStorage.setItem('adminToken', regularToken);
          localStorage.setItem('adminUser', user);
          setIsAdmin(true);
          setIsLoading(false);
          return;
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    console.log('❌ Admin Layout - No valid admin access, redirecting to login');
    setIsLoading(false);
    // If no valid admin access, redirect to admin login
    window.location.replace('/admin/secure-portal');
  }, [pathname]);

  // For login page, render children without admin layout
  if (pathname === '/admin/secure-portal') {
    return children;
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Checking authentication...</p>
        </div>
      </div>
    );
  }

  // If not admin, don't render anything (redirect will happen)
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Show admin layout with modern sidebar and header
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="container-fluid px-4 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
