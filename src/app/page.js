'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { clearOrgAuthData } from './lib/auth-utils';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Clear only organization authentication data on page load
    clearOrgAuthData();
    
    // Always redirect to organization login page (no auto-login)
    router.push('/organization/login');
  }, [router]);

  // Show loading while redirecting
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading ChangeWorks...</p>
      </div>
    </div>
  );
}
