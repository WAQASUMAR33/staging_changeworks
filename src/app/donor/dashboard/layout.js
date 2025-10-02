'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import DonorSidebar from './components/sidebar';
import DonorHeader from './components/header';

export default function DonorLayout({ children }) {
  const [isDonor, setIsDonor] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = () => {
      try {
        const token = localStorage.getItem('token');
        const user = localStorage.getItem('user');
        
        if (!token || !user) {
          router.push('/login');
          return;
        }

        const userData = JSON.parse(user);
        if (userData.role !== 'DONOR') {
          router.push('/login');
          return;
        }

        setIsDonor(true);
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading donor dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isDonor) {
    return null;
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      <div className="lg:hidden">
        <DonorSidebar />
      </div>
      
      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <DonorSidebar />
      </div>
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <DonorHeader />
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 lg:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
