import { useState, useEffect } from 'react';
import { getJSON } from '../../services/api';

interface MyReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  totalCommissions: number;
  pendingCommissions: number;
  thisMonthReferrals: number;
  thisMonthCommissions: number;
  conversionRate: number;
  averageCommissionPerReferral: number;
  monthlyStats: {
    month: string;
    newReferrals: number;
    commissionsEarned: number;
  }[];
  topPerformingReferrals: {
    _id: string;
    name: string;
    totalInvested: number;
    commissionEarned: number;
  }[];
}

interface ReferralData {
  code: string;
  link: string;
}

interface ApiResponse {
  totals: {
    total: number;
    active: number;
    thisMonth: number;
  };
  commissions: {
    earnedUSDT: number;
  };
  referral: ReferralData;
  stats: MyReferralStats;
}

interface UseMyReferralStatsReturn {
  stats: MyReferralStats | null;
  referral: ReferralData | null;
  totals: { total: number; active: number; thisMonth: number } | null;
  commissions: { earnedUSDT: number } | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useMyReferralStats = (): UseMyReferralStatsReturn => {
  const [stats, setStats] = useState<MyReferralStats | null>(null);
  const [referral, setReferral] = useState<ReferralData | null>(null);
  const [totals, setTotals] = useState<{ total: number; active: number; thisMonth: number } | null>(null);
  const [commissions, setCommissions] = useState<{ earnedUSDT: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMyStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await getJSON('/me/referrals');
      
      // La estructura real del endpoint es data.data
      const responseData = data.data || data; // Fallback por si cambia la estructura
      
      // Mapear los datos del endpoint real a la estructura esperada
      setStats(responseData.stats || null);
      setReferral({
        code: responseData.user?.referralCode || '',
        link: responseData.user?.referralCode ? `${window.location.origin}/register?ref=${responseData.user?.referralCode}` : ''
      });
      setTotals({
        total: responseData.referrals?.totalCount || 0,
        active: responseData.referrals?.users?.filter(u => u.isActive)?.length || 0,
        thisMonth: 0 // No disponible en el endpoint actual
      });
      setCommissions({
        earnedUSDT: responseData.commissions?.total?.amount || 0
      });
    } catch (err) {
      console.error('Error fetching my referral stats:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyStats();
  }, []);

  return {
    stats,
    referral,
    totals,
    commissions,
    isLoading,
    error,
    refetch: fetchMyStats
  };
};