/**
 * API Service
 * Centralized HTTP client configuration and request handling
 */

import axios from 'axios';
import toast from 'react-hot-toast';
import { handleApiError, logError } from '../utils/errorHandler';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// AbortController management for preventing concurrent requests
const activeRequests = new Map();

// Helper function to create abortable request
export const createAbortableRequest = (key) => {
  // Cancel previous request with same key if exists
  if (activeRequests.has(key)) {
    activeRequests.get(key).abort();
  }
  
  // Create new controller
  const controller = new AbortController();
  activeRequests.set(key, controller);
  
  // Clean up when request completes
  const cleanup = () => {
    if (activeRequests.get(key) === controller) {
      activeRequests.delete(key);
    }
  };
  
  return { controller, cleanup };
};

// Helper function to make abortable API calls
export const makeAbortableRequest = async (requestFn, abortKey) => {
  if (!abortKey) {
    return requestFn();
  }
  
  const { controller, cleanup } = createAbortableRequest(abortKey);
  
  try {
    const result = await requestFn(controller.signal);
    cleanup();
    return result;
  } catch (error) {
    cleanup();
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') {
      // Request was cancelled, return empty result
      return { data: { success: false, cancelled: true } };
    }
    throw error;
  }
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    // Get session from new structure
    const sessionData = localStorage.getItem('g5.session');
    if (sessionData) {
      try {
        const session = JSON.parse(sessionData);
        if (session.token) {
          config.headers.Authorization = `Bearer ${session.token}`;
        }
      } catch (error) {
        console.warn('Error parsing session data:', error);
      }
    }
    return config;
  },
  (error) => {
    logError(error, 'Request Interceptor');
    return Promise.reject(error);
  }
);

// Response interceptor for consistent error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    logError(error, 'API Response');
    
    const { response } = error;
    
    if (response?.status === 401) {
      // Clear session
      localStorage.removeItem('g5.session');
      
      // Redirect based on current context
      const currentPath = window.location.pathname;
      if (currentPath.startsWith('/admin')) {
        // Admin context - redirect to admin login
        if (!currentPath.includes('/admin/login')) {
          window.location.href = `/admin/login?returnTo=${encodeURIComponent(currentPath + window.location.search)}`;
        }
      } else {
        // User context - redirect to user login
        if (!currentPath.includes('/login') && !currentPath.includes('/register')) {
          window.location.href = `/login?returnTo=${encodeURIComponent(currentPath + window.location.search)}`;
        }
      }
      
      toast.error('Sesión expirada. Por favor, inicie sesión nuevamente.');
      return Promise.resolve({ data: { success: false, handled: true } });
    }
    
    // Get logout function from auth context if available
    const authContext = window.__AUTH_CONTEXT__;
    const logoutCallback = authContext?.logoutWithSessionInvalidation;
    
    // Handle error with consistent messaging
    const wasAuthError = handleApiError(error, logoutCallback);
    
    // Don't reject auth errors as they're handled by redirect
    if (wasAuthError) {
      return Promise.resolve({ data: { success: false, handled: true } });
    }
    
    // Handle server errors
    if (response?.status >= 500) {
      toast.error('Error del servidor. Intente nuevamente más tarde.');
      return Promise.reject(error);
    }
    
    // Handle 404 errors - return empty data instead of showing error
    if (response?.status === 404) {
      return Promise.resolve({
        data: {
          success: false,
          data: { items: [], total: 0 },
          message: 'Recurso no encontrado'
        }
      });
    }
    
    // Handle other client errors
    if (response?.status >= 400 && response?.status < 500) {
      const errorMessage = response?.data?.message || 'Error en la solicitud';
      
      // Don't show toast for validation errors (let components handle them)
      if (response?.status !== 400 || !response?.data?.code?.includes('VALIDATION')) {
        toast.error(errorMessage);
      }
      
      return Promise.reject(error);
    }
    
    // Handle network errors
    if (error.code === 'ECONNABORTED') {
      toast.error('Tiempo de espera agotado. Verifique su conexión.');
    } else if (error.message === 'Network Error') {
      toast.error('Error de conexión. Verifique su conexión a internet.');
    } else {
      toast.error('Error inesperado. Intente nuevamente.');
    }
    
    return Promise.reject(error);
  }
);

// API methods
export const apiService = {
  // Authentication
  auth: {
    register: (data) => api.post('/auth/register', data),
    login: (data) => api.post('/auth/login', data),
    logout: () => api.post('/auth/logout'),
    getProfile: (signal) => api.get('/me/profile', { signal })
  },
  
  // Packages
  packages: {
    getAll: (params) => api.get('/packages', { params }),
    getById: (id) => api.get(`/packages/${id}`),
    calculateCommissions: (packageId, referrals) => 
      api.get(`/packages/${packageId}/calculate-commissions`, { 
        params: { referrals } 
      }),
    getStats: () => api.get('/packages/stats')
  },
  
  // Payments
  payments: {
    submit: (data) => api.post('/me/purchases', {
      packageId: data.packageId,
      amountUSDT: data.amount || 1
    }),
    confirmHash: async (data) => {
      // First get purchases to find MongoDB _id
      const purchasesRes = await api.get('/me/purchases');
      const purchase = purchasesRes.data.purchases?.find(
        p => p.purchaseId === data.purchaseId
      );
      if (!purchase) throw new Error('Purchase not found');
      return api.post(`/me/purchases/${purchase._id}/confirm`, {
        txHash: data.transactionHash || data.txHash
      });
    },
    getMyPurchases: (params) => api.get('/me/purchases', { params }),
    getPurchase: (id) => api.get(`/me/purchases/${id}`)
  },
  
  // User profile and actions
  user: {
    getProfile: (signal) => api.get('/me/profile', { signal }),
    updateProfile: (data) => api.put('/me/profile', data),
    getTransactions: (params, signal) => api.get('/me/transactions', { params, signal }),
    getCommissions: (params, signal) => api.get('/me/commissions', { params, signal }),
    getWithdrawals: (params, signal) => api.get('/me/withdrawals', { params, signal }),
    getPurchases: (params, signal) => api.get('/me/purchases', { params, signal }),
    requestWithdrawal: (data) => api.post('/me/withdrawals', data),
    requestOtp: (data) => api.post('/me/otp/request', data),
    getOtpStatus: (params) => api.get('/me/otp/status', { params })
  },
  
  // Admin functions
  admin: {
    // Dashboard
    getStats: () => api.get('/admin/dashboard/stats'),
    
    // Users
    getUsers: (params) => api.get('/admin/users', { params }),
    
    // Payments
    getPendingPayments: (params) => api.get('/admin/payments/pending', { params }),
    confirmPayment: (data) => api.post('/admin/payments/confirm', data),
    rejectPayment: (data) => api.post('/admin/payments/reject', data),
    
    // Purchases
    getPurchases: (params) => api.get('/admin/purchases', { params }),
    
    // Withdrawals
    getWithdrawals: (params) => api.get('/admin/withdrawals', { params }),
    getWithdrawal: (id) => api.get(`/admin/withdrawals/${id}`),
    approveWithdrawal: (data) => api.post('/admin/withdrawals/approve', data),
    rejectWithdrawal: (data) => api.post('/admin/withdrawals/reject', data),
    completeWithdrawal: (data) => api.post('/admin/withdrawals/complete', data),
    getWithdrawalStats: () => api.get('/admin/withdrawals/stats/summary'),
    
    // CRON management
    getCronStatus: () => api.get('/cron/status'),
    getCronStats: () => api.get('/cron/stats'),
    triggerAllCron: () => api.post('/cron/trigger/all'),
    triggerBenefits: () => api.post('/cron/trigger/benefits'),
    triggerCommissions: () => api.post('/cron/trigger/commissions'),
    getUpcomingUnlocks: (params) => api.get('/cron/upcoming-unlocks', { params }),
    restartCron: () => api.post('/cron/restart'),
    getCronHealth: () => api.get('/cron/health')
  },
  
  // Benefits functions
  benefits: {
    getUserBenefits: (params) => api.get('/me/benefits', { params })
  }
};

// Utility functions for session management (legacy support)
export const apiUtils = {
  
  /**
   * Handle API error and extract message
   * @param {Error} error - API error
   * @returns {string} Error message
   */
  getErrorMessage: (error) => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    
    if (error.message) {
      return error.message;
    }
    
    return 'Error inesperado. Intente nuevamente.';
  },
  
  /**
   * Handle API error and extract validation errors
   * @param {Error} error - API error
   * @returns {Object} Validation errors
   */
  getValidationErrors: (error) => {
    if (error.response?.data?.errors) {
      const errors = {};
      error.response.data.errors.forEach(err => {
        if (err.path && err.path.length > 0) {
          errors[err.path[0]] = err.message;
        }
      });
      return errors;
    }
    
    return {};
  },
  
  /**
   * Format currency amount
   * @param {number} amount - Amount to format
   * @param {string} currency - Currency code
   * @returns {string} Formatted amount
   */
  formatCurrency: (amount, currency = 'USDT') => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 6
    }).format(amount) + ` ${currency}`;
  },
  
  /**
   * Format date
   * @param {string|Date} date - Date to format
   * @returns {string} Formatted date
   */
  formatDate: (date) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  },
  
  /**
   * Format relative time
   * @param {string|Date} date - Date to format
   * @returns {string} Relative time
   */
  formatRelativeTime: (date) => {
    const now = new Date();
    const target = new Date(date);
    const diffMs = now - target;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Ahora';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays}d`;
    
    return target.toLocaleDateString('es-ES');
  },
  
  // Legacy methods for backward compatibility
  getCurrentUser: () => {
    return apiUtils.getStoredUser();
  },
  
  getToken: () => {
    return apiUtils.getAuthToken();
  }
};

// Legacy services for backward compatibility
export const authService = {
  register: async (userData) => {
    try {
      const response = await apiService.auth.register(userData);
      
      if (response.data.token && response.data.user) {
        // Create session object
        const session = {
          token: response.data.token,
          role: response.data.user.role,
          userId: response.data.user.userId,
          email: response.data.user.email,
          exp: response.data.exp || (Date.now() + 24 * 60 * 60 * 1000) // 24h default
        };
        localStorage.setItem('g5.session', JSON.stringify(session));
      }
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  login: async (credentials) => {
    try {
      const response = await apiService.auth.login(credentials);
      
      if (response.data && response.data.token && response.data.user) {
        // Create session object
        const session = {
          token: response.data.token,
          role: response.data.user.role,
          userId: response.data.user.userId,
          email: response.data.user.email,
          exp: response.data.exp || (Date.now() + 24 * 60 * 60 * 1000) // 24h default
        };
        localStorage.setItem('g5.session', JSON.stringify(session));
      }
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      await apiService.auth.logout();
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    } finally {
      localStorage.removeItem('g5.session');
    }
  },

  verifyToken: async () => {
    try {
      const response = await apiService.auth.getProfile();
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getCurrentUser: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export const userService = {
  getProfile: async () => {
    try {
      const response = await apiService.user.getProfile();
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateProfile: async (profileData) => {
    try {
      const response = await apiService.user.updateProfile(profileData);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getDashboard: async () => {
    try {
      const response = await apiService.user.getProfile();
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export const packageService = {
  getPackages: async () => {
    try {
      const response = await apiService.packages.getAll();
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  purchasePackage: async (packageId, paymentData) => {
    try {
      const response = await apiService.payments.submit({
        packageId,
        ...paymentData
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export const transactionService = {
  getTransactions: async (page = 1, limit = 10) => {
    try {
      const response = await apiService.user.getTransactions({ page, limit });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  verifyTransaction: async (transactionHash) => {
    try {
      const response = await apiService.payments.confirmHash({
        transactionHash
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

// Funciones simplificadas para compatibilidad con hooks
const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');

export async function getJSON(path, { token, ...init } = {}) {
  const url = `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
  
  // Get token from new session structure if not provided
  let authToken = token;
  if (!authToken) {
    try {
      const sessionData = localStorage.getItem('g5.session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        authToken = session.token;
      }
    } catch (error) {
      console.warn('Error parsing session data:', error);
    }
  }
  
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    credentials: 'include',
  });
  
  if (res.status === 401) {
    try { localStorage.removeItem('g5.session'); } catch {}
    
    // Redirect based on current context
    const currentPath = window.location.pathname;
    if (currentPath.startsWith('/admin')) {
      window.location.href = '/admin/login';
    } else {
      window.location.href = '/login';
    }
    throw new Error('Unauthorized');
  }
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json();
}

export async function postJSON(path, data, { token, ...init } = {}) {
  return getJSON(path, {
    ...init,
    method: 'POST',
    body: JSON.stringify(data),
    token,
  });
}

export async function patchJSON(path, data, { token, ...init } = {}) {
  return getJSON(path, {
    ...init,
    method: 'PATCH',
    body: JSON.stringify(data),
    token,
  });
}

export async function deleteJSON(path, data, { token, ...init } = {}) {
  return getJSON(path, {
    ...init,
    method: 'DELETE',
    body: data ? JSON.stringify(data) : undefined,
    token,
  });
}

export { api };
export default api;