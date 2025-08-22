/**
 * Data Context
 * Manages global data state and automatic synchronization
 */

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { makeAbortableRequest } from '../services/api';

// Create axios instance for API calls
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  timeout: 30000, // Increased to 30s for development to handle slow API responses
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
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
});

// Data action types
const DATA_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_USER_DATA: 'UPDATE_USER_DATA',
  UPDATE_DASHBOARD_DATA: 'UPDATE_DASHBOARD_DATA',
  UPDATE_PURCHASES: 'UPDATE_PURCHASES',
  UPDATE_WITHDRAWALS: 'UPDATE_WITHDRAWALS',
  UPDATE_BALANCE: 'UPDATE_BALANCE',
  ADD_PURCHASE: 'ADD_PURCHASE',
  ADD_WITHDRAWAL: 'ADD_WITHDRAWAL',
  UPDATE_PURCHASE_STATUS: 'UPDATE_PURCHASE_STATUS',
  UPDATE_WITHDRAWAL_STATUS: 'UPDATE_WITHDRAWAL_STATUS',
  RESET_DATA: 'RESET_DATA'
};

// Initial state
const initialState = {
  isLoading: false,
  error: null,
  userData: null,
  dashboardData: null,
  purchases: [],
  withdrawals: [],
  balance: {
    available: 0,
    reserved: 0,
    total: 0
  },
  lastUpdated: null,
  syncInProgress: false
};

// Data reducer
const dataReducer = (state, action) => {
  switch (action.type) {
    case DATA_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
        syncInProgress: action.payload
      };
    
    case DATA_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        syncInProgress: false
      };
    
    case DATA_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
    
    case DATA_ACTIONS.UPDATE_USER_DATA:
      return {
        ...state,
        userData: action.payload,
        lastUpdated: new Date().toISOString(),
        isLoading: false,
        syncInProgress: false
      };
    
    case DATA_ACTIONS.UPDATE_DASHBOARD_DATA:
      return {
        ...state,
        dashboardData: action.payload,
        lastUpdated: new Date().toISOString(),
        isLoading: false,
        syncInProgress: false
      };
    
    case DATA_ACTIONS.UPDATE_PURCHASES:
      return {
        ...state,
        purchases: action.payload,
        lastUpdated: new Date().toISOString()
      };
    
    case DATA_ACTIONS.UPDATE_WITHDRAWALS:
      return {
        ...state,
        withdrawals: action.payload,
        lastUpdated: new Date().toISOString()
      };
    
    case DATA_ACTIONS.UPDATE_BALANCE:
      return {
        ...state,
        balance: action.payload,
        lastUpdated: new Date().toISOString()
      };
    
    case DATA_ACTIONS.ADD_PURCHASE:
      return {
        ...state,
        purchases: [action.payload, ...state.purchases],
        lastUpdated: new Date().toISOString()
      };
    
    case DATA_ACTIONS.ADD_WITHDRAWAL:
      return {
        ...state,
        withdrawals: [action.payload, ...state.withdrawals],
        lastUpdated: new Date().toISOString()
      };
    
    case DATA_ACTIONS.UPDATE_PURCHASE_STATUS:
      return {
        ...state,
        purchases: state.purchases.map(purchase => 
          purchase.purchaseId === action.payload.purchaseId 
            ? { ...purchase, ...action.payload.updates }
            : purchase
        ),
        lastUpdated: new Date().toISOString()
      };
    
    case DATA_ACTIONS.UPDATE_WITHDRAWAL_STATUS:
      return {
        ...state,
        withdrawals: state.withdrawals.map(withdrawal => 
          withdrawal.withdrawalId === action.payload.withdrawalId 
            ? { ...withdrawal, ...action.payload.updates }
            : withdrawal
        ),
        lastUpdated: new Date().toISOString()
      };
    
    case DATA_ACTIONS.RESET_DATA:
      return initialState;
    
    default:
      return state;
  }
};

// Create context
const DataContext = createContext();

// Custom hook to use data context
export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};

// Data provider component
export const DataProvider = ({ children }) => {
  const [state, dispatch] = useReducer(dataReducer, initialState);
  
  // Safely get auth context - handle case where AuthProvider is not ready
  let authContext;
  try {
    authContext = useAuth();
  } catch (error) {
    // AuthProvider not ready yet, provide fallback
    authContext = { isAuthenticated: false, session: null, ready: false };
  }
  
  const { isAuthenticated, session, ready: authReady } = authContext;
  const syncIntervalRef = useRef(null);
  const lastSyncRef = useRef(null);
  
  // Auto-sync interval (30 seconds)
  const SYNC_INTERVAL = 30000;
  
  // Fetch user profile data
  const fetchUserData = useCallback(async () => {
    try {
      const response = await makeAbortableRequest(
        (signal) => api.get('/me/profile', { signal }),
        'user-profile'
      );
      if (response.data?.success) {
        dispatch({ type: DATA_ACTIONS.UPDATE_USER_DATA, payload: response.data.data });
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching user data:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        hasToken: !!localStorage.getItem('g5.session')
      });
      if (error.response?.status !== 401) {
        dispatch({ type: DATA_ACTIONS.SET_ERROR, payload: 'Error al cargar datos del usuario' });
      }
    }
    }, []);
  
  // Fetch dashboard overview data
  const fetchDashboardData = useCallback(async () => {
    try {
      const response = await makeAbortableRequest(
        (signal) => api.get('/me/overview', { signal }),
        'dashboard-data'
      );
      if (response.data?.success) {
        dispatch({ type: DATA_ACTIONS.UPDATE_DASHBOARD_DATA, payload: response.data.data });
        
        // Update balance from dashboard data
        if (response.data.data.balance) {
          dispatch({ type: DATA_ACTIONS.UPDATE_BALANCE, payload: response.data.data.balance });
        }
        
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      if (error.response?.status !== 401) {
        dispatch({ type: DATA_ACTIONS.SET_ERROR, payload: 'Error al cargar datos del dashboard' });
      }
    }
  }, []);
  
  // Fetch purchases
  const fetchPurchases = useCallback(async () => {
    try {
      const response = await makeAbortableRequest(
        (signal) => api.get('/me/purchases', { signal }),
        'purchases-data'
      );
      if (response.data?.success) {
        dispatch({ type: DATA_ACTIONS.UPDATE_PURCHASES, payload: response.data.data });
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching purchases:', {
        message: error.message,
        status: error.response?.status,
        data: error.response?.data,
        hasToken: !!localStorage.getItem('g5.session'),
        endpoint: '/me/purchases'
      });
      if (error.response?.status !== 401) {
        dispatch({ type: DATA_ACTIONS.SET_ERROR, payload: 'Error al cargar compras' });
      }
    }
  }, []);
  
  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async () => {
    try {
      const response = await makeAbortableRequest(
        (signal) => api.get('/me/withdrawals', { signal }),
        'withdrawals-data'
      );
      if (response.data?.success) {
        dispatch({ type: DATA_ACTIONS.UPDATE_WITHDRAWALS, payload: response.data.data });
        return response.data.data;
      }
    } catch (error) {
      console.error('Error fetching withdrawals:', error);
      if (error.response?.status !== 401) {
        dispatch({ type: DATA_ACTIONS.SET_ERROR, payload: 'Error al cargar retiros' });
      }
    }
  }, []);
  
  // Sync all data
  const syncAllData = useCallback(async (showLoading = false) => {
    if (authReady === false || !isAuthenticated || state.syncInProgress) return;
    
    if (showLoading) {
      dispatch({ type: DATA_ACTIONS.SET_LOADING, payload: true });
    }
    
    try {
      // Execute requests sequentially to avoid overwhelming the server
      // and reduce the chance of timeouts. This prevents concurrent calls
      // that can cause 15s+ response times.
      const results = [];
      
      // Fetch user data first (most critical)
      try {
        const userData = await fetchUserData();
        results.push({ status: 'fulfilled', value: userData });
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
        console.warn('Failed to fetch user data:', error);
      }
      
      // Small delay between requests to reduce server load
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch dashboard data
      try {
        const dashboardData = await fetchDashboardData();
        results.push({ status: 'fulfilled', value: dashboardData });
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
        console.warn('Failed to fetch dashboard data:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch purchases
      try {
        const purchasesData = await fetchPurchases();
        results.push({ status: 'fulfilled', value: purchasesData });
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
        console.warn('Failed to fetch purchases:', error);
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Fetch withdrawals
      try {
        const withdrawalsData = await fetchWithdrawals();
        results.push({ status: 'fulfilled', value: withdrawalsData });
      } catch (error) {
        results.push({ status: 'rejected', reason: error });
        console.warn('Failed to fetch withdrawals:', error);
      }
      
      lastSyncRef.current = Date.now();
      dispatch({ type: DATA_ACTIONS.CLEAR_ERROR });
    } catch (error) {
      console.error('Error syncing data:', error);
    } finally {
      if (showLoading) {
        dispatch({ type: DATA_ACTIONS.SET_LOADING, payload: false });
      }
    }
  }, [authReady, isAuthenticated, state.syncInProgress, fetchUserData, fetchDashboardData, fetchPurchases, fetchWithdrawals]);
  
  // Force refresh data
  const refreshData = useCallback(() => {
    syncAllData(true);
  }, [syncAllData]);
  
  // Add new purchase to state
  const addPurchase = useCallback((purchase) => {
    dispatch({ type: DATA_ACTIONS.ADD_PURCHASE, payload: purchase });
    // Refresh dashboard data to get updated balance
    setTimeout(() => fetchDashboardData(), 1000);
  }, [fetchDashboardData]);
  
  // Add new withdrawal to state
  const addWithdrawal = useCallback((withdrawal) => {
    dispatch({ type: DATA_ACTIONS.ADD_WITHDRAWAL, payload: withdrawal });
    // Refresh dashboard data to get updated balance
    setTimeout(() => fetchDashboardData(), 1000);
  }, [fetchDashboardData]);
  
  // Update purchase status
  const updatePurchaseStatus = useCallback((purchaseId, updates) => {
    dispatch({ 
      type: DATA_ACTIONS.UPDATE_PURCHASE_STATUS, 
      payload: { purchaseId, updates } 
    });
    // Refresh dashboard data if status affects balance
    if (updates.status === 'ACTIVE' || updates.status === 'COMPLETED') {
      setTimeout(() => fetchDashboardData(), 1000);
    }
  }, [fetchDashboardData]);
  
  // Update withdrawal status
  const updateWithdrawalStatus = useCallback((withdrawalId, updates) => {
    dispatch({ 
      type: DATA_ACTIONS.UPDATE_WITHDRAWAL_STATUS, 
      payload: { withdrawalId, updates } 
    });
    // Refresh dashboard data if status affects balance
    if (updates.status === 'COMPLETED' || updates.status === 'REJECTED') {
      setTimeout(() => fetchDashboardData(), 1000);
    }
  }, [fetchDashboardData]);
  
  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: DATA_ACTIONS.CLEAR_ERROR });
  }, []);
  
  // Setup auto-sync when authenticated and auth is ready
  useEffect(() => {
    // Only proceed if AuthProvider is ready
    if (authReady !== false && isAuthenticated && session) {
      // Initial data load
      syncAllData(true);
      
      // Setup auto-sync interval
      syncIntervalRef.current = setInterval(() => {
        syncAllData(false);
      }, SYNC_INTERVAL);
      
      return () => {
        if (syncIntervalRef.current) {
          clearInterval(syncIntervalRef.current);
        }
      };
    } else if (authReady !== false && !isAuthenticated) {
      // Clear data when not authenticated (but only if auth is ready)
      dispatch({ type: DATA_ACTIONS.RESET_DATA });
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    }
  }, [authReady, isAuthenticated, session, syncAllData]);
  
  // Listen for storage events (cross-tab synchronization)
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === 'data-sync-trigger' && authReady !== false && isAuthenticated) {
        // Another tab triggered a data sync
        setTimeout(() => syncAllData(false), 500);
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [authReady, isAuthenticated, syncAllData]);
  
  // Trigger cross-tab sync
  const triggerCrossTabSync = useCallback(() => {
    localStorage.setItem('data-sync-trigger', Date.now().toString());
    setTimeout(() => {
      localStorage.removeItem('data-sync-trigger');
    }, 1000);
  }, []);
  
  const value = {
    // State
    ...state,
    
    // Actions
    refreshData,
    syncAllData,
    addPurchase,
    addWithdrawal,
    updatePurchaseStatus,
    updateWithdrawalStatus,
    clearError,
    triggerCrossTabSync,
    
    // Individual fetch functions
    fetchUserData,
    fetchDashboardData,
    fetchPurchases,
    fetchWithdrawals
  };
  
  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export { DataContext };
export default DataContext;