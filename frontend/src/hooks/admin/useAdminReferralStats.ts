import { useState, useEffect } from 'react';
import { getJSON } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface ReferralStats {
  totalUsers: number;
  totalReferrals: number;
  totalCommissions: number;
  activeReferrers: number;
  topReferrers: {
    _id: string;
    name: string;
    email: string;
    totalReferrals: number;
    totalCommissions: number;
  }[];
  monthlyStats: {
    month: string;
    newReferrals: number;
    commissionsPaid: number;
  }[];
  conversionRate: number;
  averageCommissionPerReferral: number;
}

interface UseAdminReferralStatsReturn {
  stats: ReferralStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useAdminReferralStats = (): UseAdminReferralStatsReturn => {
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const fetchStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!session?.token) {
        throw new Error('No hay token de autenticación');
      }
      
      // Usar el endpoint específico de stats
      const data = await getJSON('/admin/referrals/stats', { token: session.token });
      
      if (data.success && data.stats) {
        // Usar las estadísticas del endpoint específico
        const statsData = {
          totalUsers: data.stats.totalUsers || 0,
          totalReferrals: data.stats.totalReferrals || 0,
          totalCommissions: data.stats.commissions?.total?.amount || 0,
          activeReferrers: data.stats.activeReferrers || 0,
          topReferrers: (data.stats.topReferrers || []).map(u => ({
            _id: u._id,
            name: u.name,
            email: u.email,
            totalReferrals: u.referralCount || 0,
            totalCommissions: 0 // No disponible en este endpoint
          })),
          monthlyStats: data.stats.monthlyStats || [],
          conversionRate: data.stats.conversionRate || 0,
          averageCommissionPerReferral: data.stats.averageCommissionPerReferral || 0
        };
        setStats(statsData);
      } else {
        throw new Error(data.message || 'Error al obtener las estadísticas');
      }
    } catch (err) {
      console.error('Error fetching admin referral stats:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats
  };
};