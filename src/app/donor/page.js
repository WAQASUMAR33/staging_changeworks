'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DonorRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to donor login page
    router.replace('/donor/login');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Redirecting to donor login...</p>
      </div>
    </div>
  );
}
