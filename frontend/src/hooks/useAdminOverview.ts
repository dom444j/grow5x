import { useState, useEffect, useRef, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { getJSON } from '../services/api';

export interface OverviewData {
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

export function useAdminOverview() {
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);

  // Get token from localStorage
  useEffect(() => {
    const getToken = () => {
      try {
        const sessionData = localStorage.getItem('g5.session');
        if (!sessionData) return null;
        
        const session = JSON.parse(sessionData);
        return session.token || null;
      } catch (error) {
        return null;
      }
    };
    
    setToken(getToken());
  }, []);

  const fetchOverview = useCallback(async () => {
    if (!token) {
      setError('No hay token de autenticación');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const result = await getJSON('/admin/overview') as {success: boolean, data: OverviewData};
      
      if (!result.success) {
        throw new Error('Error al obtener datos del overview');
      }

      setData(result.data);
      setLastUpdated(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      toast.error(`Error al cargar overview: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    
    // Cargar datos inicialmente
    fetchOverview();
    
    // Configurar actualización automática cada 30 segundos
    intervalRef.current = setInterval(() => {
      fetchOverview();
    }, 30000);
    
    // Limpiar intervalo al desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [token, fetchOverview]);

  return {
    data,
    loading,
    error,
    lastUpdated,
    refetch: fetchOverview
  };
}