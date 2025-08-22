// Simple EventEmitter implementation for browser compatibility
class SimpleEventEmitter {
  constructor() {
    this.events = {};
  }

  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  emit(event, ...args) {
    if (this.events[event]) {
      this.events[event].forEach(listener => listener(...args));
    }
  }

  off(event, listener) {
    if (this.events[event]) {
      this.events[event] = this.events[event].filter(l => l !== listener);
    }
  }

  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
  }
}

class RealtimeService extends SimpleEventEmitter {
  constructor() {
    super();
    this.eventSource = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 30000; // Max 30 seconds
    this.userId = null;
    this.isAdmin = false;
  }

  /**
   * Initialize connection for user
   * @param {string} userId - User ID
   * @param {string} token - Auth token
   */
  connectUser(userId, token) {
    this.userId = userId;
    this.isAdmin = false;
    this.connect(`/api/rt/user/${userId}`, token);
  }

  /**
   * Initialize connection for admin
   * @param {string} token - Auth token
   */
  connectAdmin(token) {
    this.isAdmin = true;
    this.connect('/api/rt/admin', token);
  }

  /**
   * Establish SSE connection
   * @param {string} endpoint - SSE endpoint
   * @param {string} token - Auth token
   */
  connect(endpoint, token) {
    if (this.eventSource) {
      this.disconnect();
    }

    try {
      const url = new URL(endpoint, window.location.origin);
      url.searchParams.set('token', token);
      
      this.eventSource = new EventSource(url.toString());
      
      this.eventSource.onopen = () => {
        console.log('SSE connection established');
        this.isConnected = true;
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.emit('connected');
      };
      
      this.eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleMessage(data);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };
      
      this.eventSource.onerror = (error) => {
        console.error('SSE connection error:', error);
        this.isConnected = false;
        this.emit('error', error);
        
        if (this.eventSource.readyState === EventSource.CLOSED) {
          this.handleReconnect();
        }
      };
      
    } catch (error) {
      console.error('Failed to establish SSE connection:', error);
      this.emit('error', error);
      this.handleReconnect();
    }
  }

  /**
   * Handle incoming messages
   * @param {Object} data - Message data
   */
  handleMessage(data) {
    const { type, timestamp, data: messageData } = data;
    
    console.log('Received SSE message:', { type, timestamp });
    
    // Emit specific events based on message type
    switch (type) {
      case 'USER_UPDATE':
        this.emit('userUpdate', messageData);
        break;
      case 'ADMIN_UPDATE':
        this.emit('adminUpdate', messageData);
        break;
      case 'PURCHASE_CONFIRMED':
        this.emit('purchaseConfirmed', messageData);
        break;
      case 'WITHDRAWAL_REQUESTED':
        this.emit('withdrawalRequested', messageData);
        break;
      case 'COMMISSION_EARNED':
        this.emit('commissionEarned', messageData);
        break;
      case 'LICENSE_PAUSED':
        this.emit('licensePaused', messageData);
        break;
      case 'LICENSE_RESUMED':
        this.emit('licenseResumed', messageData);
        break;
      case 'LICENSE_COMPLETED':
        this.emit('licenseCompleted', messageData);
        break;
      case 'BENEFIT_PAID':
        this.emit('benefitPaid', messageData);
        break;
      case 'HEALTH_UPDATE':
        this.emit('healthUpdate', messageData);
        break;
      default:
        this.emit('message', data);
    }
  }

  /**
   * Handle reconnection logic
   */
  handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.emit('maxReconnectAttemptsReached');
      return;
    }
    
    this.reconnectAttempts++;
    const delay = Math.min(this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1), this.maxReconnectDelay);
    
    console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      if (!this.isConnected) {
        const endpoint = this.isAdmin ? '/api/rt/admin' : `/api/rt/user/${this.userId}`;
        const token = this.getStoredToken();
        if (token) {
          this.connect(endpoint, token);
        }
      }
    }, delay);
  }

  /**
   * Get stored authentication token
   * @returns {string|null} Token
   */
  getStoredToken() {
    return localStorage.getItem('token') || sessionStorage.getItem('token');
  }

  /**
   * Disconnect SSE connection
   */
  disconnect() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.emit('disconnected');
  }

  /**
   * Get connection status
   * @returns {boolean} Connection status
   */
  getConnectionStatus() {
    return this.isConnected;
  }

  /**
   * Send test message (for debugging)
   * @param {string} message - Test message
   */
  async sendTestMessage(message) {
    try {
      const token = this.getStoredToken();
      const response = await fetch('/api/rt/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ message })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Failed to send test message:', error);
      throw error;
    }
  }
}

// Create singleton instance
const realtimeService = new RealtimeService();

export default realtimeService;