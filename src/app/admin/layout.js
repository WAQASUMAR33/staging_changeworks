'use client';

import { useEffect, useState } from 'react';
import Sidebar from './components/sidebar';
import Header from './components/header';

export default function AdminLayout({ children }) {
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user has admin token or is an admin user
    const adminToken = localStorage.getItem('adminToken');
    const regularToken = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    
    // Check if user is admin through admin token
    if (adminToken) {
      setIsAdmin(true);
      return;
    }
    
    // Check if user is admin through regular token
    if (regularToken && user) {
      try {
        const userData = JSON.parse(user);
        if (userData.role === 'ADMIN' || userData.role === 'SUPERADMIN' || userData.role === 'MANAGER') {
          // Convert regular token to admin token
          localStorage.setItem('adminToken', regularToken);
          localStorage.setItem('adminUser', user);
          setIsAdmin(true);
          return;
        }
      } catch (error) {
        console.error('Error parsing user data:', error);
      }
    }
    
    // If no valid admin access, redirect to admin login
    window.location.replace('/admin/login');
  }, []);

  // If not admin, don't render anything (redirect will happen)
  if (!isAdmin) {
    return null;
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
