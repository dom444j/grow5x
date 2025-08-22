import { useState, useEffect, useCallback } from 'react';
import realtimeService from '../services/realtimeService';
import { useAuth } from '../contexts/AuthContext';

/**
 * Custom hook for real-time updates
 * @param {Object} options - Configuration options
 * @param {boolean} options.autoConnect - Auto connect on mount (default: true)
 * @param {Array} options.events - Specific events to listen for
 * @returns {Object} Realtime state and methods
 */
export const useRealtime = (options = {}) => {
  const { autoConnect = true, events = [] } = options;
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [lastMessage, setLastMessage] = useState(null);
  const [messageHistory, setMessageHistory] = useState([]);

  // Connect to realtime service
  const connect = useCallback(() => {
    if (!token || !user) {
      console.warn('Cannot connect to realtime service: missing token or user');
      return;
    }

    try {
      if (user.role === 'admin') {
        realtimeService.connectAdmin(token);
      } else {
        realtimeService.connectUser(user._id, token);
      }
    } catch (error) {
      console.error('Failed to connect to realtime service:', error);
      setConnectionError(error);
    }
  }, [token, user]);

  // Disconnect from realtime service
  const disconnect = useCallback(() => {
    realtimeService.disconnect();
  }, []);

  // Send test message
  const sendTestMessage = useCallback(async (message) => {
    try {
      return await realtimeService.sendTestMessage(message);
    } catch (error) {
      console.error('Failed to send test message:', error);
      throw error;
    }
  }, []);

  // Setup event listeners
  useEffect(() => {
    const handleConnected = () => {
      setIsConnected(true);
      setConnectionError(null);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    const handleError = (error) => {
      setConnectionError(error);
      setIsConnected(false);
    };

    const handleMessage = (data) => {
      setLastMessage(data);
      setMessageHistory(prev => {
        const newHistory = [...prev, { ...data, timestamp: new Date() }];
        // Keep only last 100 messages
        return newHistory.slice(-100);
      });
    };

    // Register event listeners
    realtimeService.on('connected', handleConnected);
    realtimeService.on('disconnected', handleDisconnected);
    realtimeService.on('error', handleError);
    realtimeService.on('message', handleMessage);

    // Register specific event listeners if provided
    const eventHandlers = {};
    events.forEach(eventName => {
      const handler = (data) => {
        setLastMessage({ type: eventName, data });
        setMessageHistory(prev => {
          const newHistory = [...prev, { type: eventName, data, timestamp: new Date() }];
          return newHistory.slice(-100);
        });
      };
      eventHandlers[eventName] = handler;
      realtimeService.on(eventName, handler);
    });

    // Cleanup function
    return () => {
      realtimeService.off('connected', handleConnected);
      realtimeService.off('disconnected', handleDisconnected);
      realtimeService.off('error', handleError);
      realtimeService.off('message', handleMessage);
      
      // Remove specific event listeners
      events.forEach(eventName => {
        if (eventHandlers[eventName]) {
          realtimeService.off(eventName, eventHandlers[eventName]);
        }
      });
    };
  }, [events]);

  // Auto connect on mount
  useEffect(() => {
    if (autoConnect && token && user) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      if (autoConnect) {
        disconnect();
      }
    };
  }, [autoConnect, connect, disconnect, token, user]);

  return {
    isConnected,
    connectionError,
    lastMessage,
    messageHistory,
    connect,
    disconnect,
    sendTestMessage,
    service: realtimeService
  };
};

/**
 * Hook for listening to specific realtime events
 * @param {string|Array} eventNames - Event name(s) to listen for
 * @param {Function} callback - Callback function to handle events
 * @param {Array} deps - Dependencies for the callback
 */
export const useRealtimeEvent = (eventNames, callback, deps = []) => {
  const events = Array.isArray(eventNames) ? eventNames : [eventNames];

  useEffect(() => {
    const handlers = {};
    
    events.forEach(eventName => {
      const handler = (data) => {
        callback(eventName, data);
      };
      handlers[eventName] = handler;
      realtimeService.on(eventName, handler);
    });

    return () => {
      events.forEach(eventName => {
        if (handlers[eventName]) {
          realtimeService.off(eventName, handlers[eventName]);
        }
      });
    };
  }, [events.join(','), ...deps]);
};

/**
 * Hook for purchase-related realtime events
 */
export const usePurchaseRealtime = (callback) => {
  useRealtimeEvent(['purchaseConfirmed', 'commissionEarned'], callback);
};

/**
 * Hook for withdrawal-related realtime events
 */
export const useWithdrawalRealtime = (callback) => {
  useRealtimeEvent(['withdrawalRequested'], callback);
};

/**
 * Hook for license-related realtime events
 */
export const useLicenseRealtime = (callback) => {
  useRealtimeEvent(['licensePaused', 'licenseResumed', 'licenseCompleted', 'benefitPaid'], callback);
};

/**
 * Hook for license realtime events with query invalidation
 * @param {Function} invalidateQueries - Function to invalidate queries (from react-query)
 */
export const useLicenseRealtimeWithInvalidation = (invalidateQueries) => {
  useRealtimeEvent(['licensePaused', 'licenseResumed', 'licenseCompleted', 'benefitPaid'], (eventType, data) => {
    console.log(`License event received: ${eventType}`, data);
    
    // Invalidate user licenses queries to refresh the UI
    if (invalidateQueries) {
      invalidateQueries(['/user/licenses']);
    }
  });
};

/**
 * Hook for admin-specific realtime events
 */
export const useAdminRealtime = (callback) => {
  useRealtimeEvent(['adminUpdate', 'healthUpdate'], callback);
};

export default useRealtime;