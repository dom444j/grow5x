/**
 * Authentication Context
 * Provides authentication state and methods throughout the application
 */

import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback, useMemo } from 'react';
import { authService, apiUtils } from '../services/api';
import axios from 'axios';
import { toast } from 'react-hot-toast';

// Create axios instance for direct API calls
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

// Funciones de utilidad para manejar la sesión
const SESSION_KEY = 'g5.session';

const getStoredSession = () => {
  try {
    const stored = localStorage.getItem(SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Error parsing stored session:', error);
    return null;
  }
};

const setStoredSession = (session) => {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error('Error storing session:', error);
  }
};

const clearSession = () => {
  localStorage.removeItem(SESSION_KEY);
};

// Initial state
const initialState = {
  session: null, // { token, role, userId, email, exp }
  isAuthenticated: false,
  isLoading: true, // Empieza en true para el bootstrap
  ready: false, // Indica si la hidratación terminó
  error: null
};

// Action types
const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_ERROR: 'SET_ERROR',
  CLEAR_ERROR: 'CLEAR_ERROR',
  UPDATE_USER: 'UPDATE_USER'
};

// Reducer function
const authReducer = (state, action) => {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload
      };
    
    case 'BOOTSTRAP_COMPLETE':
      return {
        ...state,
        session: action.payload.session,
        isAuthenticated: !!action.payload.session,
        isLoading: false,
        ready: true,
        error: null
      };
    
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return {
        ...state,
        session: action.payload.session,
        isAuthenticated: true,
        isLoading: false,
        ready: true,
        error: null
      };
    
    case AUTH_ACTIONS.LOGOUT:
      return {
        ...state,
        session: null,
        isAuthenticated: false,
        isLoading: false,
        ready: true,
        error: null
      };
    
    case AUTH_ACTIONS.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false
      };
    
    case AUTH_ACTIONS.CLEAR_ERROR:
      return {
        ...state,
        error: null
      };
    
    case AUTH_ACTIONS.UPDATE_USER:
      return {
        ...state,
        session: {
          ...state.session,
          user: { ...state.session?.user, ...action.payload }
        }
      };
    
    default:
      return state;
  }
};

// Create context
const AuthContext = createContext();

// Custom hook to use auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Auto-logout configuration
const INACTIVITY_TIMEOUT = 45 * 60 * 1000; // 45 minutes
const WARNING_TIME = 5 * 60 * 1000; // 5 minutes warning
const STORAGE_KEY = 'lastActivity';
const ACTIVITY_EVENTS = [
  'mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click', 'focus'
];

// Auth provider component
export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);
  
  // Auto-logout refs
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);

  // Bootstrap: hidratar sesión al cargar la aplicación
  useEffect(() => {
    const bootstrap = async () => {
      try {
        const storedSession = getStoredSession();
        console.log('Bootstrap - stored session:', storedSession);
        
        if (storedSession && storedSession.token) {
          // Verificar si el token no ha expirado (con margen de 5 minutos)
          const currentTime = Math.floor(Date.now() / 1000);
          const tokenExpired = storedSession.exp && (currentTime > storedSession.exp - 300); // 5 min buffer
          
          if (tokenExpired) {
            console.log('Token expired, clearing session');
            clearSession();
            dispatch({ type: 'BOOTSTRAP_COMPLETE', payload: { session: null } });
            return;
          }
          
          // Verificar si el token es válido obteniendo los datos del usuario
          try {
            const response = await api.get('/auth/me');
            const userData = response.data?.data?.user || response.data?.user || response.data;
            
            if (userData && userData.userId) {
              // Actualizar sesión con datos frescos del servidor
              const updatedSession = {
                ...storedSession,
                userId: userData.userId,
                email: userData.email,
                role: userData.role,
                user: userData // Almacenar toda la información del usuario
              };
              setStoredSession(updatedSession);
              dispatch({ type: 'BOOTSTRAP_COMPLETE', payload: { session: updatedSession } });
            } else {
              // Token inválido, limpiar datos
              clearSession();
              dispatch({ type: 'BOOTSTRAP_COMPLETE', payload: { session: null } });
            }
          } catch (error) {
            // Token is invalid or expired, clear auth data
            console.log('Token validation failed:', error.response?.status);
            clearSession();
            dispatch({ type: 'BOOTSTRAP_COMPLETE', payload: { session: null } });
          }
        } else {
          console.log('Bootstrap - no stored session found');
          dispatch({ type: 'BOOTSTRAP_COMPLETE', payload: { session: null } });
        }
      } catch (error) {
        console.error('Error during bootstrap:', error);
        // Si hay error (token expirado, etc.), limpiar datos
        clearSession();
        dispatch({ type: 'BOOTSTRAP_COMPLETE', payload: { session: null } });
      }
    };

    bootstrap();
  }, []);

  // Login function
  const login = async (credentials) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
      
      const response = await authService.login(credentials);
      
      // Debug: Log the response structure
      console.log('Login response:', response);
      console.log('Response data:', response.data);
      
      // Crear sesión con datos del login
      const session = {
        token: response.data.token,
        role: response.data.user.role,
        userId: response.data.user.userId,
        email: response.data.user.email,
        user: response.data.user, // Almacenar toda la información del usuario
        exp: response.data.exp // Si viene del backend
      };
      
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { session }
      });
      
      // Almacenar sesión en localStorage
      setStoredSession(session);
      
      toast.success(`¡Bienvenido, ${response.data.user.firstName}!`);
      return { success: true, user: response.data.user, token: response.data.token };
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error);
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  // Register function
  const register = async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
      
      const response = await authService.register(userData);
      
      // Crear sesión con datos del registro
      const session = {
        token: response.data.token,
        role: response.data.user.role,
        userId: response.data.user.userId,
        email: response.data.user.email,
        user: response.data.user,
        exp: response.data.exp // Si viene del backend
      };
      
      dispatch({
        type: AUTH_ACTIONS.LOGIN_SUCCESS,
        payload: { session }
      });
      
      // Almacenar sesión en localStorage
      setStoredSession(session);
      
      toast.success(`¡Cuenta creada exitosamente! Bienvenido, ${response.data.user.firstName}!`);
        return { success: true, user: response.data.user, token: response.data.token };
    } catch (error) {
      const errorMessage = apiUtils.getErrorMessage(error);
      dispatch({ type: AUTH_ACTIONS.SET_ERROR, payload: errorMessage });
      toast.error(errorMessage);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      clearSession();
      toast.success('Sesión cerrada exitosamente');
    }
  };

  // Auto-logout functions
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem(STORAGE_KEY, now.toString());
    warningShownRef.current = false;
  }, []);

  const showInactivityWarning = useCallback(() => {
    if (!warningShownRef.current && state.isAuthenticated) {
      warningShownRef.current = true;
      toast.error(
        'Tu sesión expirará en 5 minutos por inactividad. Mueve el mouse para mantenerla activa.',
        {
          duration: 10000,
          id: 'inactivity-warning'
        }
      );
    }
  }, [state.isAuthenticated]);

  const performAutoLogout = useCallback(async () => {
    if (state.isAuthenticated) {
      try {
        await authService.logout();
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
        clearSession();
        toast.error('Sesión cerrada automáticamente por inactividad', {
          duration: 5000,
          id: 'auto-logout'
        });
        window.location.href = '/login';
      } catch (error) {
        console.error('Error during auto-logout:', error);
      }
    }
  }, [state.isAuthenticated]);

  const resetInactivityTimer = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);

    if (!state.isAuthenticated) return;

    warningTimeoutRef.current = setTimeout(() => {
      showInactivityWarning();
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    timeoutRef.current = setTimeout(() => {
      performAutoLogout();
    }, INACTIVITY_TIMEOUT);
  }, [state.isAuthenticated, showInactivityWarning, performAutoLogout]);

  const handleActivity = useCallback(() => {
    updateActivity();
    resetInactivityTimer();
  }, [updateActivity, resetInactivityTimer]);

  // Enhanced logout with session invalidation
  const logoutWithSessionInvalidation = async () => {
    try {
      // Call backend to invalidate session if supported
      await authService.logout();
    } catch (error) {
      console.error('Error during logout:', error);
    } finally {
      // Clear local auth state
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      
      // Clear all localStorage auth data
      clearSession();
      
      // Broadcast logout to other tabs
      localStorage.setItem('logout-broadcast', Date.now().toString());
      setTimeout(() => {
        localStorage.removeItem('logout-broadcast');
      }, 1000);
      
      toast.success('Sesión cerrada exitosamente');
    }
  };

  // Logout all sessions
  const logoutAllSessions = useCallback(async () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      await authService.logout();
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
      clearSession();
      
      localStorage.setItem('logout-broadcast', Date.now().toString());
      setTimeout(() => {
        localStorage.removeItem('logout-broadcast');
      }, 1000);
      
      toast.success('Todas las sesiones han sido cerradas');
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      toast.error('Error al cerrar todas las sesiones');
    }
  }, []);

  // Get remaining time until auto-logout
  const getRemainingTime = useCallback(() => {
    if (!state.isAuthenticated) return 0;
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    const remainingTime = Math.max(0, INACTIVITY_TIMEOUT - timeSinceActivity);
    return Math.floor(remainingTime / 1000);
  }, [state.isAuthenticated]);

  // Update user function
  const updateUser = (userData) => {
    dispatch({ type: AUTH_ACTIONS.UPDATE_USER, payload: userData });
    // Also update stored session data
    const currentSession = getStoredSession();
    if (currentSession) {
      const updatedSession = {
        ...currentSession,
        user: { ...currentSession.user, ...userData }
      };
      setStoredSession(updatedSession);
    }
  };

  // Clear error function
  const clearError = () => {
    dispatch({ type: AUTH_ACTIONS.CLEAR_ERROR });
  };

  // Refresh user data using GET /api/me
  const refreshUser = async () => {
    try {
      const userData = await authService.getCurrentUser();
      updateUser(userData);
      return userData;
    } catch (error) {
      console.error('Error refreshing user data:', error);
      
      // Handle 401/403 errors by logging out
      if (error.response?.status === 401 || error.response?.status === 403) {
        logout();
        window.location.href = '/login';
      }
      
      throw error;
    }
  };

  // Handle API errors globally (401/403)
  const handleApiError = (error) => {
    if (error.response?.status === 401 || error.response?.status === 403) {
      console.log('Unauthorized access detected, logging out...');
      logoutWithSessionInvalidation();
      window.location.href = '/login';
      return true; // Indicates error was handled
    }
    return false; // Error not handled
  };

  // Enhanced error handling with consistent mapping
  const handleApiErrorWithToast = (error) => {
    const status = error.response?.status;
    const message = apiUtils.getErrorMessage(error);
    
    switch (status) {
      case 400:
        toast.error(`Error de validación: ${message}`);
        break;
      case 401:
      case 403:
        toast.error('Sesión expirada. Redirigiendo al login...');
        logoutWithSessionInvalidation();
        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);
        return true;
      case 429:
        toast.error('Demasiadas solicitudes. Intenta nuevamente en unos minutos.');
        break;
      case 500:
        toast.error('Error interno del servidor. Intenta nuevamente.');
        break;
      default:
        toast.error(message || 'Error inesperado. Intenta nuevamente.');
    }
    return false;
  };

  // Check if user has specific role
  const hasRole = (role) => {
    // Check both session.role and session.user.role for compatibility
    return state.session?.role === role || state.session?.user?.role === role;
  };

  // Check if user is admin
  const isAdmin = () => {
    return hasRole('admin');
  };

  // Check if user is support
  const isSupport = () => {
    return hasRole('support');
  };

  // Check if user account is active
  const isAccountActive = () => {
    return state.session?.user?.status === 'active';
  };

  // Get user's referral code
  const getReferralCode = () => {
    return state.session?.user?.referralCode;
  };

  // Get user's balance
  const getBalance = (currency = 'USDT') => {
    return state.session?.user?.balances?.[currency] || 0;
  };

  // Initialize auto-logout functionality
  useEffect(() => {
    if (!state.isAuthenticated) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
      return;
    }

    // Initialize activity timestamp
    updateActivity();
    
    // Set up activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Initialize timer
    resetInactivityTimer();

    // Cleanup function
    return () => {
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (warningTimeoutRef.current) clearTimeout(warningTimeoutRef.current);
    };
  }, [state.isAuthenticated, handleActivity, resetInactivityTimer, updateActivity]);

  // Cross-tab activity detection
  useEffect(() => {
    const checkCrossTabActivity = () => {
      const storedActivity = localStorage.getItem(STORAGE_KEY);
      if (storedActivity && state.isAuthenticated) {
        const lastActivity = parseInt(storedActivity, 10);
        const timeSinceActivity = Date.now() - lastActivity;
        
        if (timeSinceActivity < INACTIVITY_TIMEOUT) {
          lastActivityRef.current = lastActivity;
          resetInactivityTimer();
        }
      }
    };

    const interval = setInterval(checkCrossTabActivity, 30000);
    return () => clearInterval(interval);
  }, [state.isAuthenticated, resetInactivityTimer]);

  // Listen for logout broadcasts from other tabs
  useEffect(() => {
    const handleLogoutBroadcast = (e) => {
      if (e.key === 'logout-broadcast' && e.newValue && state.isAuthenticated) {
        // Another tab initiated logout, clear local state
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
        window.location.href = '/login';
      }
    };

    window.addEventListener('storage', handleLogoutBroadcast);
    return () => {
      window.removeEventListener('storage', handleLogoutBroadcast);
    };
  }, [state.isAuthenticated]);

  // Context value - memoized to prevent unnecessary re-renders
  const value = useMemo(() => ({
    // State
    session: state.session,
    user: state.session?.user,
    token: state.session?.token,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    ready: state.ready,
    error: state.error,
    
    // Actions
    login,
    register,
    logout,
    logoutWithSessionInvalidation,
    logoutAllSessions,
    updateUser,
    clearError,
    refreshUser,
    handleApiError,
    handleApiErrorWithToast,
    
    // Utility functions
    hasRole,
    isAdmin,
    isSupport,
    isAccountActive,
    getReferralCode,
    getBalance,
    getRemainingTime,
    resetActivityTimer: handleActivity
  }), [
    state.session,
    state.isAuthenticated,
    state.isLoading,
    state.ready,
    state.error,
    login,
    register,
    logout,
    logoutWithSessionInvalidation,
    logoutAllSessions,
    updateUser,
    clearError,
    refreshUser,
    handleApiError,
    handleApiErrorWithToast,
    hasRole,
    isAdmin,
    isSupport,
    isAccountActive,
    getReferralCode,
    getBalance,
    getRemainingTime,
    handleActivity
  ]);

  // Expose auth context globally for interceptors
  React.useEffect(() => {
    window.__AUTH_CONTEXT__ = value;
    return () => {
      delete window.__AUTH_CONTEXT__;
    };
  }, [value]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;