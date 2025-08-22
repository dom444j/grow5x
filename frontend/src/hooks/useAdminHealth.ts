import { useState, useEffect } from 'react';
import { getJSON } from '../services/api';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'down';
  timestamp: string;
  services: {
    database: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      lastCheck: string;
    };
    cron: {
      status: 'healthy' | 'degraded' | 'down';
      lastRun: string;
      nextRun: string;
    };
    telegram: {
      status: 'healthy' | 'degraded' | 'down';
      lastNotification: string;
    };
    api: {
      status: 'healthy' | 'degraded' | 'down';
      responseTime: number;
      uptime: number;
    };
  };
  metrics: {
    totalUsers: number;
    activeUsers: number;
    totalPurchases: number;
    pendingPurchases: number;
    totalWithdrawals: number;
    pendingWithdrawals: number;
    systemLoad: number;
    memoryUsage: number;
  };
  reports?: {
    salesTodayUSDT?: number;
    parentGlobalQueuedD17?: {
      count: number;
      amountUSDT: number;
    };
  };
  audit?: {
    actions24h: number;
  };
}

interface UseAdminHealth {
  health: HealthStatus | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  autoRefresh: boolean;
  setAutoRefresh: (enabled: boolean) => void;
}

export const useAdminHealth = (refreshInterval: number = 30000): UseAdminHealth => {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchHealth = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getJSON('/admin/health');
      if (response) {
        setHealth(response);
      }
    } catch (err: any) {
      // Si el endpoint devuelve 503, el sistema está down pero es una respuesta válida
      if (err.response?.status === 503) {
        setHealth({
          status: 'down',
          timestamp: new Date().toISOString(),
          services: {
            database: { status: 'down', responseTime: 0, lastCheck: new Date().toISOString() },
            cron: { status: 'down', lastRun: '', nextRun: '' },
            telegram: { status: 'down', lastNotification: '' },
            api: { status: 'down', responseTime: 0, uptime: 0 }
          },
          metrics: {
            totalUsers: 0,
            activeUsers: 0,
            totalPurchases: 0,
            pendingPurchases: 0,
            totalWithdrawals: 0,
            pendingWithdrawals: 0,
            systemLoad: 0,
            memoryUsage: 0
          }
        });
      } else {
        setError(err.response?.data?.message || 'Error al verificar estado del sistema');
        console.error('Error fetching health status:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchHealth();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval]);

  return {
    health,
    loading,
    error,
    refetch: fetchHealth,
    autoRefresh,
    setAutoRefresh
  };
};