// Authentication utility functions

/**
 * Clear all authentication data from both localStorage and sessionStorage
 */
export function clearAllAuthData() {
  // Clear organization auth data
  localStorage.removeItem('orgToken');
  localStorage.removeItem('orgUser');
  localStorage.removeItem('orgRememberMe');
  sessionStorage.removeItem('orgToken');
  sessionStorage.removeItem('orgUser');
  
  // Clear admin auth data
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('user');
}

/**
 * Clear only organization authentication data
 */
export function clearOrgAuthData() {
  localStorage.removeItem('orgToken');
  localStorage.removeItem('orgUser');
  localStorage.removeItem('orgRememberMe');
  sessionStorage.removeItem('orgToken');
  sessionStorage.removeItem('orgUser');
}

/**
 * Check if organization is authenticated (session-based)
 */
export function isOrgAuthenticated() {
  const token = sessionStorage.getItem('orgToken');
  const user = sessionStorage.getItem('orgUser');
  return !!(token && user);
}

/**
 * Get current organization user data
 */
export function getCurrentOrgUser() {
  const userStr = sessionStorage.getItem('orgUser');
  if (!userStr) return null;
  
  try {
    return JSON.parse(userStr);
  } catch (error) {
    console.error('Error parsing organization user data:', error);
    return null;
  }
}

/**
 * Force logout and redirect to login page
 */
export function forceLogout() {
  clearAllAuthData();
  window.location.href = '/organization/login';
}
