'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OrganizationRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to organization login page
    router.replace('/organization/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to organization login...</p>
      </div>
    </div>
  );
}
