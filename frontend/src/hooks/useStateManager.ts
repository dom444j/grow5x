/**
 * React Hook for State Manager Integration
 * Provides reactive state management with automatic re-renders
 * Handles real-time updates and WebSocket connections
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import stateManager, { UserState, AdminState } from '../services/stateManager';

// Hook for user state management
export const useUserState = () => {
  const [state, setState] = useState<UserState>(stateManager.getUserState());
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    // Update state when changes occur
    const handleStateUpdate = () => {
      if (mountedRef.current) {
        setState(stateManager.getUserState());
      }
    };

    // Handle WebSocket connection status
    const handleWebSocketConnected = () => {
      if (mountedRef.current) {
        setIsConnected(true);
      }
    };

    const handleWebSocketDisconnected = () => {
      if (mountedRef.current) {
        setIsConnected(false);
      }
    };

    // Subscribe to state manager events
    stateManager.on('user:overview:updated', handleStateUpdate);
    stateManager.on('user:withdrawals:updated', handleStateUpdate);
    stateManager.on('user:purchases:updated', handleStateUpdate);
    stateManager.on('user:loading', handleStateUpdate);
    stateManager.on('user:error', handleStateUpdate);
    stateManager.on('websocket:connected', handleWebSocketConnected);
    stateManager.on('websocket:disconnected', handleWebSocketDisconnected);

    // Initial WebSocket status
    const wsStatus = stateManager.getWebSocketStatus();
    setIsConnected(wsStatus.connected);

    // Initial data fetch
    stateManager.refreshUserOverview();

    return () => {
      mountedRef.current = false;
      stateManager.off('user:overview:updated', handleStateUpdate);
      stateManager.off('user:withdrawals:updated', handleStateUpdate);
      stateManager.off('user:purchases:updated', handleStateUpdate);
      stateManager.off('user:loading', handleStateUpdate);
      stateManager.off('user:error', handleStateUpdate);
      stateManager.off('websocket:connected', handleWebSocketConnected);
      stateManager.off('websocket:disconnected', handleWebSocketDisconnected);
    };
  }, []);

  const refresh = useCallback(() => {
    stateManager.forceRefresh();
  }, []);

  const refreshOverview = useCallback(() => {
    stateManager.refreshUserOverview();
  }, []);

  const refreshWithdrawals = useCallback(() => {
    stateManager.refreshUserWithdrawals();
  }, []);

  const refreshPurchases = useCallback(() => {
    stateManager.refreshUserPurchases();
  }, []);

  return {
    ...state,
    isConnected,
    refresh,
    refreshOverview,
    refreshWithdrawals,
    refreshPurchases
  };
};

// Hook for admin state management
export const useAdminState = () => {
  const [state, setState] = useState<AdminState>(stateManager.getAdminState());
  const [isConnected, setIsConnected] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    // Update state when changes occur
    const handleStateUpdate = () => {
      if (mountedRef.current) {
        setState(stateManager.getAdminState());
      }
    };

    // Handle WebSocket connection status
    const handleWebSocketConnected = () => {
      if (mountedRef.current) {
        setIsConnected(true);
      }
    };

    const handleWebSocketDisconnected = () => {
      if (mountedRef.current) {
        setIsConnected(false);
      }
    };

    // Subscribe to state manager events
    stateManager.on('admin:overview:updated', handleStateUpdate);
    stateManager.on('admin:loading', handleStateUpdate);
    stateManager.on('admin:error', handleStateUpdate);
    stateManager.on('admin:update', handleStateUpdate);
    stateManager.on('websocket:connected', handleWebSocketConnected);
    stateManager.on('websocket:disconnected', handleWebSocketDisconnected);

    // Initial WebSocket status
    const wsStatus = stateManager.getWebSocketStatus();
    setIsConnected(wsStatus.connected);

    // Initial data fetch
    stateManager.refreshAdminOverview();

    return () => {
      mountedRef.current = false;
      stateManager.off('admin:overview:updated', handleStateUpdate);
      stateManager.off('admin:loading', handleStateUpdate);
      stateManager.off('admin:error', handleStateUpdate);
      stateManager.off('admin:update', handleStateUpdate);
      stateManager.off('websocket:connected', handleWebSocketConnected);
      stateManager.off('websocket:disconnected', handleWebSocketDisconnected);
    };
  }, []);

  const refresh = useCallback(() => {
    stateManager.forceRefresh();
  }, []);

  const refreshOverview = useCallback(() => {
    stateManager.refreshAdminOverview();
  }, []);

  return {
    ...state,
    isConnected,
    refresh,
    refreshOverview
  };
};

// Hook for real-time notifications
export const useRealtimeNotifications = () => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const handleNotification = (notification: any) => {
      if (mountedRef.current) {
        setNotifications(prev => [notification, ...prev.slice(0, 9)]); // Keep last 10
      }
    };

    const handleBalanceUpdate = (data: any) => {
      if (mountedRef.current && data.change !== 0) {
        const notification = {
          id: `balance_${Date.now()}`,
          type: 'balance_update',
          title: data.change > 0 ? 'Balance Increased' : 'Balance Decreased',
          message: `Your balance ${data.change > 0 ? 'increased' : 'decreased'} by $${Math.abs(data.change).toFixed(2)}`,
          timestamp: new Date().toISOString(),
          data
        };
        handleNotification(notification);
      }
    };

    const handlePurchaseUpdate = (data: any) => {
      if (mountedRef.current) {
        const notification = {
          id: `purchase_${data.purchaseId}_${Date.now()}`,
          type: 'purchase_update',
          title: 'Purchase Status Updated',
          message: `Purchase ${data.purchaseId} is now ${data.status.toLowerCase()}`,
          timestamp: new Date().toISOString(),
          data
        };
        handleNotification(notification);
      }
    };

    const handleWithdrawalUpdate = (data: any) => {
      if (mountedRef.current) {
        const notification = {
          id: `withdrawal_${data.withdrawalId}_${Date.now()}`,
          type: 'withdrawal_update',
          title: 'Withdrawal Status Updated',
          message: `Withdrawal ${data.withdrawalId} is now ${data.status.toLowerCase()}`,
          timestamp: new Date().toISOString(),
          data
        };
        handleNotification(notification);
      }
    };

    const handleBenefitReceived = (data: any) => {
      if (mountedRef.current) {
        const notification = {
          id: `benefit_${data.purchaseId}_${data.day}_${Date.now()}`,
          type: 'benefit_received',
          title: 'Daily Benefit Received',
          message: `You received $${data.amount.toFixed(2)} from your investment`,
          timestamp: new Date().toISOString(),
          data
        };
        handleNotification(notification);
      }
    };

    const handleReferralCommission = (data: any) => {
      if (mountedRef.current) {
        const notification = {
          id: `referral_${data.referredUserId}_${Date.now()}`,
          type: 'referral_commission',
          title: 'Referral Commission Earned',
          message: `You earned $${data.amount.toFixed(2)} from a referral`,
          timestamp: new Date().toISOString(),
          data
        };
        handleNotification(notification);
      }
    };

    // Subscribe to events
    stateManager.on('notification', handleNotification);
    stateManager.on('balance:updated', handleBalanceUpdate);
    stateManager.on('purchase:updated', handlePurchaseUpdate);
    stateManager.on('withdrawal:updated', handleWithdrawalUpdate);
    stateManager.on('benefit:received', handleBenefitReceived);
    stateManager.on('referral:commission', handleReferralCommission);

    return () => {
      mountedRef.current = false;
      stateManager.off('notification', handleNotification);
      stateManager.off('balance:updated', handleBalanceUpdate);
      stateManager.off('purchase:updated', handlePurchaseUpdate);
      stateManager.off('withdrawal:updated', handleWithdrawalUpdate);
      stateManager.off('benefit:received', handleBenefitReceived);
      stateManager.off('referral:commission', handleReferralCommission);
    };
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    clearNotifications,
    removeNotification
  };
};

// Hook for authentication state
export const useAuthState = () => {
  const [authState, setAuthState] = useState(stateManager.getAuthState());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const handleAuthChange = (newAuthState: any) => {
      if (mountedRef.current) {
        setAuthState(newAuthState);
      }
    };

    stateManager.on('auth:changed', handleAuthChange);

    return () => {
      mountedRef.current = false;
      stateManager.off('auth:changed', handleAuthChange);
    };
  }, []);

  const login = useCallback((token: string, role: 'user' | 'admin' = 'user') => {
    stateManager.setAuth(token, role);
  }, []);

  const logout = useCallback(() => {
    stateManager.clearAuth();
  }, []);

  return {
    ...authState,
    login,
    logout
  };
};

// Hook for WebSocket connection status
export const useWebSocketStatus = () => {
  const [status, setStatus] = useState(stateManager.getWebSocketStatus());
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    
    const updateStatus = () => {
      if (mountedRef.current) {
        setStatus(stateManager.getWebSocketStatus());
      }
    };

    stateManager.on('websocket:connected', updateStatus);
    stateManager.on('websocket:disconnected', updateStatus);
    stateManager.on('websocket:error', updateStatus);

    return () => {
      mountedRef.current = false;
      stateManager.off('websocket:connected', updateStatus);
      stateManager.off('websocket:disconnected', updateStatus);
      stateManager.off('websocket:error', updateStatus);
    };
  }, []);

  return status;
};

// Combined hook for complete state management
export const useAppState = () => {
  const authState = useAuthState();
  const userState = useUserState();
  const adminState = useAdminState();
  const notifications = useRealtimeNotifications();
  const wsStatus = useWebSocketStatus();

  return {
    auth: authState,
    user: userState,
    admin: adminState,
    notifications,
    websocket: wsStatus
  };
};

export default useAppState;