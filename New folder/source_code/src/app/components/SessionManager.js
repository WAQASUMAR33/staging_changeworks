'use client';
import { useEffect } from 'react';
import { clearAllAuthData } from '../lib/auth-utils';

/**
 * SessionManager component to handle session cleanup
 * This component should be included in the root layout
 */
export default function SessionManager() {
  useEffect(() => {
    // Clear session data when the browser window is closed
    const handleBeforeUnload = () => {
      // Only clear localStorage, keep sessionStorage for tab refresh
      localStorage.removeItem('orgToken');
      localStorage.removeItem('orgUser');
      localStorage.removeItem('orgRememberMe');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('rememberMe');
    };

    // Clear all data when the browser is completely closed
    const handleUnload = () => {
      clearAllAuthData();
    };

    // Add event listeners
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('unload', handleUnload);

    // Cleanup event listeners on component unmount
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('unload', handleUnload);
    };
  }, []);

  // This component doesn't render anything visible
  return null;
}
