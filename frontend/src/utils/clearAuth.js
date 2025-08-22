// Utility to clear authentication data
export const clearAuthData = () => {
  // Clear all possible auth-related localStorage items
  localStorage.removeItem('g5.session');
  localStorage.removeItem('lastActivity');
  localStorage.removeItem('auth_token');
  localStorage.removeItem('user');
  localStorage.removeItem('session');
  
  // Clear all sessionStorage items
  sessionStorage.clear();
  
  console.log('Auth data cleared from localStorage and sessionStorage');
};

// Auto-clear on import for debugging
if (window.location.search.includes('clearauth')) {
  clearAuthData();
  // Reload without the clearauth parameter
  const url = new URL(window.location);
  url.searchParams.delete('clearauth');
  window.location.replace(url.toString());
}