/**
 * Auto-logout hook for handling user inactivity
 * Automatically logs out users after a specified period of inactivity
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'react-hot-toast';

// Configuration
const INACTIVITY_TIMEOUT = 45 * 60 * 1000; // 45 minutes in milliseconds
const WARNING_TIME = 5 * 60 * 1000; // Show warning 5 minutes before logout
const STORAGE_KEY = 'lastActivity';

// Events that reset the inactivity timer
const ACTIVITY_EVENTS = [
  'mousedown',
  'mousemove',
  'keypress',
  'scroll',
  'touchstart',
  'click',
  'focus'
];

export const useAutoLogout = () => {
  const { logout, isAuthenticated } = useAuth();
  const timeoutRef = useRef(null);
  const warningTimeoutRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const warningShownRef = useRef(false);

  // Update last activity timestamp
  const updateActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    localStorage.setItem(STORAGE_KEY, now.toString());
    warningShownRef.current = false;
  }, []);

  // Show warning before auto-logout
  const showWarning = useCallback(() => {
    if (!warningShownRef.current && isAuthenticated) {
      warningShownRef.current = true;
      toast.error(
        'Tu sesión expirará en 5 minutos por inactividad. Mueve el mouse para mantenerla activa.',
        {
          duration: 10000,
          id: 'inactivity-warning'
        }
      );
    }
  }, [isAuthenticated]);

  // Perform auto-logout
  const performAutoLogout = useCallback(async () => {
    if (isAuthenticated) {
      try {
        await logout();
        toast.error('Sesión cerrada automáticamente por inactividad', {
          duration: 5000,
          id: 'auto-logout'
        });
        
        // Redirect to login page
        window.location.href = '/login';
      } catch (error) {
        console.error('Error during auto-logout:', error);
      }
    }
  }, [logout, isAuthenticated]);

  // Reset inactivity timer
  const resetTimer = useCallback(() => {
    // Clear existing timers
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (warningTimeoutRef.current) {
      clearTimeout(warningTimeoutRef.current);
    }

    if (!isAuthenticated) {
      return;
    }

    // Set warning timer (5 minutes before logout)
    warningTimeoutRef.current = setTimeout(() => {
      showWarning();
    }, INACTIVITY_TIMEOUT - WARNING_TIME);

    // Set logout timer
    timeoutRef.current = setTimeout(() => {
      performAutoLogout();
    }, INACTIVITY_TIMEOUT);
  }, [isAuthenticated, showWarning, performAutoLogout]);

  // Handle activity events
  const handleActivity = useCallback(() => {
    updateActivity();
    resetTimer();
  }, [updateActivity, resetTimer]);

  // Check for activity in other tabs/windows
  const checkCrossTabActivity = useCallback(() => {
    const storedActivity = localStorage.getItem(STORAGE_KEY);
    if (storedActivity) {
      const lastActivity = parseInt(storedActivity, 10);
      const timeSinceActivity = Date.now() - lastActivity;
      
      if (timeSinceActivity < INACTIVITY_TIMEOUT) {
        // Activity detected in another tab, reset timer
        lastActivityRef.current = lastActivity;
        resetTimer();
      }
    }
  }, [resetTimer]);

  // Initialize auto-logout functionality
  useEffect(() => {
    if (!isAuthenticated) {
      // Clear timers when not authenticated
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      return;
    }

    // Initialize activity timestamp
    updateActivity();
    
    // Set up activity listeners
    ACTIVITY_EVENTS.forEach(event => {
      document.addEventListener(event, handleActivity, true);
    });

    // Set up storage listener for cross-tab activity detection
    window.addEventListener('storage', checkCrossTabActivity);

    // Set up periodic check for cross-tab activity
    const crossTabInterval = setInterval(checkCrossTabActivity, 30000); // Check every 30 seconds

    // Initialize timer
    resetTimer();

    // Cleanup function
    return () => {
      // Remove event listeners
      ACTIVITY_EVENTS.forEach(event => {
        document.removeEventListener(event, handleActivity, true);
      });
      window.removeEventListener('storage', checkCrossTabActivity);
      
      // Clear timers and intervals
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (warningTimeoutRef.current) {
        clearTimeout(warningTimeoutRef.current);
      }
      clearInterval(crossTabInterval);
    };
  }, [isAuthenticated, handleActivity, checkCrossTabActivity, resetTimer, updateActivity]);

  // Manual logout all sessions function
  const logoutAllSessions = useCallback(async () => {
    try {
      // Clear all stored activity data
      localStorage.removeItem(STORAGE_KEY);
      
      // Perform logout
      await logout();
      
      // Broadcast logout to other tabs
      localStorage.setItem('logout-broadcast', Date.now().toString());
      setTimeout(() => {
        localStorage.removeItem('logout-broadcast');
      }, 1000);
      
      toast.success('Todas las sesiones han sido cerradas', {
        duration: 3000
      });
      
      // Redirect to login
      window.location.href = '/login';
    } catch (error) {
      console.error('Error logging out all sessions:', error);
      toast.error('Error al cerrar todas las sesiones');
    }
  }, [logout]);

  // Listen for logout broadcasts from other tabs
  useEffect(() => {
    const handleLogoutBroadcast = (e) => {
      if (e.key === 'logout-broadcast' && e.newValue) {
        // Another tab initiated logout, redirect this tab too
        window.location.href = '/login';
      }
    };

    window.addEventListener('storage', handleLogoutBroadcast);
    return () => {
      window.removeEventListener('storage', handleLogoutBroadcast);
    };
  }, []);

  // Get remaining time until auto-logout
  const getRemainingTime = useCallback(() => {
    if (!isAuthenticated) return 0;
    
    const timeSinceActivity = Date.now() - lastActivityRef.current;
    const remainingTime = Math.max(0, INACTIVITY_TIMEOUT - timeSinceActivity);
    return Math.floor(remainingTime / 1000); // Return in seconds
  }, [isAuthenticated]);

  return {
    logoutAllSessions,
    getRemainingTime,
    resetTimer: handleActivity, // Expose manual reset function
    isWarningShown: warningShownRef.current
  };
};

export default useAutoLogout;