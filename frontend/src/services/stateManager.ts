/**
 * State Manager Service
 * Handles centralized state management and real-time synchronization
 * Provides reactive state updates across the application
 */

// Browser-compatible EventEmitter implementation
class EventEmitter {
  private events: { [key: string]: Function[] } = {};

  on(event: string, listener: Function) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event: string, ...args: any[]) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }

  removeListener(event: string, listener: Function) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }

  removeAllListeners(event?: string) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}
import { getJSON, postJSON } from './api';

// State interfaces
export interface UserState {
  overview: UserOverview | null;
  withdrawals: Withdrawal[] | null;
  purchases: Purchase[] | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

export interface AdminState {
  overview: AdminOverview | null;
  withdrawals: AdminWithdrawal[] | null;
  purchases: AdminPurchase[] | null;
  users: AdminUser[] | null;
  isLoading: boolean;
  lastUpdated: Date | null;
  error: string | null;
}

export interface UserOverview {
  balance: {
    available: number;
    invested: number;
    withdrawn: number;
  };
  licenses: {
    active: number;
    completed: number;
  };
  withdrawals: {
    pending: number;
  };
  referral: {
    code: string;
    link: string;
    total: number;
    active: number;
  };
  stats: {
    totalInvested: number;
    totalWithdrawn: number;
  };
}

export interface AdminOverview {
  asOf: string;
  sales: {
    count24h: number;
    amount24hUSDT: number;
    count7d: number;
    amount7dUSDT: number;
  };
  referrals: {
    direct24hUSDT: number;
    parentGlobalQueuedUSDT: number;
    parentGlobalReleased24hUSDT: number;
  };
  benefits: {
    todayUSDT: number;
    pendingCount: number;
    paidCount: number;
  };
  withdrawals: {
    pending: number;
    approved: number;
    completed24h: number;
    slaHitRate7d: number;
  };
  poolV2: {
    total: number;
    available: number;
    medianIntervalMs: number;
    p90IntervalMs: number;
  };
}

export interface Withdrawal {
  withdrawalId: string;
  amount: number;
  currency: string;
  destinationAddress: string;
  network: string;
  status: string;
  requestedAt: string;
  completedAt?: string;
}

export interface Purchase {
  purchaseId: string;
  packageId: string;
  totalAmount: number;
  currency: string;
  status: string;
  createdAt: string;
  activatedAt?: string;
}

export interface AdminWithdrawal extends Withdrawal {
  userId: string;
  userEmail: string;
}

export interface AdminPurchase extends Purchase {
  userId: string;
  userEmail: string;
}

export interface AdminUser {
  userId: string;
  email: string;
  balanceUSDT: number;
  totalInvested: number;
  totalWithdrawn: number;
  referralCode: string;
  createdAt: string;
}

class StateManager extends EventEmitter {
  private userState: UserState;
  private adminState: AdminState;
  private websocket: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isAuthenticated = false;
  private userRole: 'user' | 'admin' | null = null;
  private token: string | null = null;
  private refreshIntervals: Map<string, number> = new Map();

  constructor() {
    super();
    
    this.userState = {
      overview: null,
      withdrawals: null,
      purchases: null,
      isLoading: false,
      lastUpdated: null,
      error: null
    };

    this.adminState = {
      overview: null,
      withdrawals: null,
      purchases: null,
      users: null,
      isLoading: false,
      lastUpdated: null,
      error: null
    };

    this.initializeAuth();
  }

  /**
   * Initialize authentication state
   */
  private initializeAuth() {
    try {
      const sessionData = localStorage.getItem('g5.session');
      if (sessionData) {
        const session = JSON.parse(sessionData);
        this.token = session.token;
        this.userRole = session.role || 'user';
        this.isAuthenticated = !!this.token;
        
        if (this.isAuthenticated) {
          this.connectWebSocket();
          this.startPeriodicRefresh();
        }
      }
    } catch (error) {
      console.error('Failed to initialize auth state:', error);
    }
  }

  /**
   * Set authentication state
   */
  setAuth(token: string, role: 'user' | 'admin' = 'user') {
    this.token = token;
    this.userRole = role;
    this.isAuthenticated = true;
    
    this.connectWebSocket();
    this.startPeriodicRefresh();
    
    this.emit('auth:changed', { authenticated: true, role });
  }

  /**
   * Clear authentication state
   */
  clearAuth() {
    this.token = null;
    this.userRole = null;
    this.isAuthenticated = false;
    
    this.disconnectWebSocket();
    this.stopPeriodicRefresh();
    this.clearState();
    
    this.emit('auth:changed', { authenticated: false, role: null });
  }

  /**
   * Connect to WebSocket for real-time updates
   */
  private connectWebSocket() {
    if (!this.isAuthenticated || this.websocket?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${wsProtocol}//${window.location.host}/ws?token=${this.token}&role=${this.userRole}`;
      
      this.websocket = new WebSocket(wsUrl);
      
      this.websocket.onopen = () => {
        console.log('WebSocket connected');
        this.reconnectAttempts = 0;
        this.emit('websocket:connected');
      };
      
      this.websocket.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleWebSocketMessage(message);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      this.websocket.onclose = () => {
        console.log('WebSocket disconnected');
        this.websocket = null;
        this.emit('websocket:disconnected');
        
        if (this.isAuthenticated && this.reconnectAttempts < this.maxReconnectAttempts) {
          setTimeout(() => {
            this.reconnectAttempts++;
            this.connectWebSocket();
          }, this.reconnectDelay * Math.pow(2, this.reconnectAttempts));
        }
      };
      
      this.websocket.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.emit('websocket:error', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }

  /**
   * Disconnect WebSocket
   */
  private disconnectWebSocket() {
    if (this.websocket) {
      this.websocket.close();
      this.websocket = null;
    }
  }

  /**
   * Handle WebSocket messages
   */
  private handleWebSocketMessage(message: any) {
    const { type, data } = message;
    
    switch (type) {
      case 'USER_UPDATE':
        this.handleUserUpdate(data);
        break;
      case 'ADMIN_UPDATE':
        this.handleAdminUpdate(data);
        break;
      case 'SYSTEM_NOTIFICATION':
        this.emit('notification', data);
        break;
      default:
        console.log('Unknown WebSocket message type:', type);
    }
  }

  /**
   * Handle user-specific updates
   */
  private handleUserUpdate(data: any) {
    switch (data.type) {
      case 'BALANCE_UPDATE':
        this.refreshUserOverview();
        this.emit('balance:updated', data);
        break;
      case 'PURCHASE_STATUS_CHANGE':
        this.refreshUserOverview();
        this.refreshUserPurchases();
        this.emit('purchase:updated', data);
        break;
      case 'WITHDRAWAL_STATUS_CHANGE':
        this.refreshUserOverview();
        this.refreshUserWithdrawals();
        this.emit('withdrawal:updated', data);
        break;
      case 'BENEFIT_ACCRUAL':
        this.refreshUserOverview();
        this.emit('benefit:received', data);
        break;
      case 'REFERRAL_COMMISSION':
        this.refreshUserOverview();
        this.emit('referral:commission', data);
        break;
    }
  }

  /**
   * Handle admin-specific updates
   */
  private handleAdminUpdate(data: any) {
    if (this.userRole !== 'admin') return;
    
    switch (data.type) {
      case 'PURCHASE_STATUS_CHANGE':
      case 'WITHDRAWAL_STATUS_CHANGE':
      case 'SIGNIFICANT_BALANCE_CHANGE':
        this.refreshAdminOverview();
        this.emit('admin:update', data);
        break;
    }
  }

  /**
   * Start periodic refresh based on cache strategy
   */
  private startPeriodicRefresh() {
    this.stopPeriodicRefresh();
    
    if (this.userRole === 'admin') {
      // Admin: 15 second refresh
      const adminInterval = setInterval(() => {
        this.refreshAdminOverview();
      }, 15000);
      this.refreshIntervals.set('admin', adminInterval);
    } else {
      // User: 10 second refresh
      const userInterval = setInterval(() => {
        this.refreshUserOverview();
      }, 10000);
      this.refreshIntervals.set('user', userInterval);
    }
  }

  /**
   * Stop periodic refresh
   */
  private stopPeriodicRefresh() {
    this.refreshIntervals.forEach((interval) => {
      clearInterval(interval);
    });
    this.refreshIntervals.clear();
  }

  /**
   * Clear all state
   */
  private clearState() {
    this.userState = {
      overview: null,
      withdrawals: null,
      purchases: null,
      isLoading: false,
      lastUpdated: null,
      error: null
    };

    this.adminState = {
      overview: null,
      withdrawals: null,
      purchases: null,
      users: null,
      isLoading: false,
      lastUpdated: null,
      error: null
    };

    this.emit('state:cleared');
  }

  /**
   * Refresh user overview data
   */
  async refreshUserOverview() {
    if (!this.isAuthenticated || this.userRole === 'admin') return;
    
    try {
      this.userState.isLoading = true;
      this.userState.error = null;
      this.emit('user:loading', true);
      
      const response = await getJSON('/api/me/overview') as { success: boolean; data: UserOverview };
      
      if (response.success) {
        this.userState.overview = response.data;
        this.userState.lastUpdated = new Date();
        this.emit('user:overview:updated', response.data);
      }
    } catch (error: any) {
      this.userState.error = error.message || 'Failed to refresh user overview';
      this.emit('user:error', this.userState.error);
    } finally {
      this.userState.isLoading = false;
      this.emit('user:loading', false);
    }
  }

  /**
   * Refresh user withdrawals
   */
  async refreshUserWithdrawals() {
    if (!this.isAuthenticated || this.userRole === 'admin') return;
    
    try {
      const response = await getJSON('/api/me/withdrawals') as { success: boolean; data: Withdrawal[] };
      
      if (response.success) {
        this.userState.withdrawals = response.data;
        this.emit('user:withdrawals:updated', response.data);
      }
    } catch (error: any) {
      console.error('Failed to refresh user withdrawals:', error);
    }
  }

  /**
   * Refresh user purchases
   */
  async refreshUserPurchases() {
    if (!this.isAuthenticated || this.userRole === 'admin') return;
    
    try {
      const response = await getJSON('/api/me/purchases') as { success: boolean; data: Purchase[] };
      
      if (response.success) {
        this.userState.purchases = response.data;
        this.emit('user:purchases:updated', response.data);
      }
    } catch (error: any) {
      console.error('Failed to refresh user purchases:', error);
    }
  }

  /**
   * Refresh admin overview data
   */
  async refreshAdminOverview() {
    if (!this.isAuthenticated || this.userRole !== 'admin') return;
    
    try {
      this.adminState.isLoading = true;
      this.adminState.error = null;
      this.emit('admin:loading', true);
      
      const response = await getJSON('/admin/overview') as { success: boolean; data: AdminOverview };
      
      if (response.success) {
        this.adminState.overview = response.data;
        this.adminState.lastUpdated = new Date();
        this.emit('admin:overview:updated', response.data);
      }
    } catch (error: any) {
      this.adminState.error = error.message || 'Failed to refresh admin overview';
      this.emit('admin:error', this.adminState.error);
    } finally {
      this.adminState.isLoading = false;
      this.emit('admin:loading', false);
    }
  }

  /**
   * Get current user state
   */
  getUserState(): UserState {
    return { ...this.userState };
  }

  /**
   * Get current admin state
   */
  getAdminState(): AdminState {
    return { ...this.adminState };
  }

  /**
   * Get authentication state
   */
  getAuthState() {
    return {
      isAuthenticated: this.isAuthenticated,
      role: this.userRole,
      token: this.token
    };
  }

  /**
   * Force refresh all data
   */
  async forceRefresh() {
    if (this.userRole === 'admin') {
      await this.refreshAdminOverview();
    } else {
      await Promise.all([
        this.refreshUserOverview(),
        this.refreshUserWithdrawals(),
        this.refreshUserPurchases()
      ]);
    }
  }

  /**
   * Get WebSocket connection status
   */
  getWebSocketStatus() {
    return {
      connected: this.websocket?.readyState === WebSocket.OPEN,
      reconnectAttempts: this.reconnectAttempts
    };
  }
}

// Export singleton instance
export const stateManager = new StateManager();
export default stateManager;