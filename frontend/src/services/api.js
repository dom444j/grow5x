/**
 * API Service
 * Centralized HTTP client configuration and request handling
 */

import axios from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;
    
    if (response) {
      const { status, data } = response;
      
      // Handle authentication errors
      if (status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        
        // Only redirect if not already on auth pages
        if (!window.location.pathname.includes('/login') && 
            !window.location.pathname.includes('/register')) {
          window.location.href = '/login';
        }
        
        toast.error('Sesión expirada. Por favor, inicie sesión nuevamente.');
        return Promise.reject(error);
      }
      
      // Handle rate limiting
      if (status === 429) {
        toast.error('Demasiadas solicitudes. Intente nuevamente en unos minutos.');
        return Promise.reject(error);
      }
      
      // Handle server errors
      if (status >= 500) {
        toast.error('Error del servidor. Intente nuevamente más tarde.');
        return Promise.reject(error);
      }
      
      // Handle other client errors
      if (status >= 400 && status < 500) {
        const errorMessage = data?.message || 'Error en la solicitud';
        
        // Don't show toast for validation errors (let components handle them)
        if (status !== 400 || !data?.code?.includes('VALIDATION')) {
          toast.error(errorMessage);
        }
        
        return Promise.reject(error);
      }
    } else if (error.code === 'ECONNABORTED') {
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
    getProfile: () => api.get('/me/profile')
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
    submit: (data) => api.post('/payments/submit', data),
    confirmHash: (data) => api.post('/payments/confirm-hash', data),
    getMyPurchases: (params) => api.get('/payments/my-purchases', { params }),
    getPurchase: (id) => api.get(`/payments/purchase/${id}`)
  },
  
  // User profile and actions
  user: {
    getProfile: () => api.get('/me/profile'),
    updateProfile: (data) => api.put('/me/profile', data),
    getTransactions: (params) => api.get('/me/transactions', { params }),
    getCommissions: (params) => api.get('/me/commissions', { params }),
    getWithdrawals: (params) => api.get('/me/withdrawals', { params }),
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
  }
};

// Utility functions
export const apiUtils = {
  /**
   * Set authentication token
   * @param {string} token - JWT token
   */
  setAuthToken: (token) => {
    if (token) {
      localStorage.setItem('authToken', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      localStorage.removeItem('authToken');
      delete api.defaults.headers.common['Authorization'];
    }
  },
  
  /**
   * Get current auth token
   * @returns {string|null} Current token
   */
  getAuthToken: () => {
    return localStorage.getItem('authToken');
  },
  
  /**
   * Clear authentication data
   */
  clearAuth: () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    delete api.defaults.headers.common['Authorization'];
  },
  
  /**
   * Check if user is authenticated
   * @returns {boolean} Is authenticated
   */
  isAuthenticated: () => {
    const token = localStorage.getItem('authToken');
    return !!token;
  },
  
  /**
   * Get stored user data
   * @returns {Object|null} User data
   */
  getStoredUser: () => {
    const userData = localStorage.getItem('user');
    return userData ? JSON.parse(userData) : null;
  },
  
  /**
   * Store user data
   * @param {Object} user - User data
   */
  setStoredUser: (user) => {
    localStorage.setItem('user', JSON.stringify(user));
  },
  
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
      
      if (response.data.token) {
        apiUtils.setAuthToken(response.data.token);
        apiUtils.setStoredUser(response.data.user);
      }
      
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  login: async (credentials) => {
    try {
      const response = await apiService.auth.login(credentials);
      
      if (response.data.token) {
        apiUtils.setAuthToken(response.data.token);
        apiUtils.setStoredUser(response.data.user);
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
      apiUtils.clearAuth();
    }
  },

  verifyToken: async () => {
    try {
      const response = await apiService.auth.getProfile();
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

export default api;