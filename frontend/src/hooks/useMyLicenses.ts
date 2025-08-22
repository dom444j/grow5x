import { useEffect, useState } from 'react';
import { withAuth } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

interface License {
  _id: string;
  principalUSDT: number;
  accruedUSDT: number;
  earnedPct: number;     // Ganado %
  capPct: number;        // Tope %
  remainingUSDT: number;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
  daysGenerated: number;
  startedAt?: string;
  isPaused?: boolean;
  dailyBenefitAmount?: number;
  remainingAmount?: number;
  scheduleStatus?: string;
  package?: {
    name: string;
    dailyRate: number;
  };
  totalAmount?: number;
  capPercentMax?: number;
  pauseReason?: string;
  progressPercent?: number;
  remainingDays?: number;
  capReached?: boolean;
}

interface UseMyLicensesReturn {
  items: License[];
  loading: boolean;
  error: any;
  refetch: () => Promise<void>;
}

export function useMyLicenses(status: string = 'ALL'): UseMyLicensesReturn {
  const { token } = useAuth();
  const [data, setData] = useState<{ items: License[]; loading: boolean; error: any }>({
    items: [],
    loading: true,
    error: null
  });

  const refetch = async () => {
    if (!token) return;
    
    try {
      setData(prev => ({ ...prev, loading: true, error: null }));
      const api = withAuth(token);
      const res = await api.GET(`/user/licenses?status=${status}`);
      setData({ items: (res as any).items || [], loading: false, error: null });
    } catch (e: any) {
      setData({ items: [], loading: false, error: e });
    }
  };

  useEffect(() => {
    if (token) {
      refetch();
    }
  }, [token, status]);

  return { ...data, refetch };
}