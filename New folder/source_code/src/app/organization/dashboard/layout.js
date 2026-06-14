'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import OrgSidebar from './components/sidebar';
import OrgHeader from './components/header';

export default function OrganizationLayout({ children }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check if organization is logged in with session-based storage
    const token = sessionStorage.getItem('orgToken');
    const user = sessionStorage.getItem('orgUser');
    
    // Also check if there's any old localStorage data and clear it
    if (localStorage.getItem('orgToken') || localStorage.getItem('orgUser')) {
      localStorage.removeItem('orgToken');
      localStorage.removeItem('orgUser');
      localStorage.removeItem('orgRememberMe');
    }
    
    if (!token || !user) {
      router.push('/organization/login');
      return;
    }

    setIsLoading(false);
  }, [router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full overflow-hidden bg-gray-50">
      <OrgSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <OrgHeader />
        <main className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
