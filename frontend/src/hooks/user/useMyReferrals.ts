import { useState, useEffect } from 'react';
import { getJSON } from '../../services/api';
import { UIError } from '../../lib/types';

interface MyReferral {
  _id: string;
  name: string;
  email: string;
  createdAt: string;
  isActive: boolean;
  totalInvested: number;
  commissionEarned: number;
  lastActivity: string;
}

interface UseMyReferralsReturn {
  referrals: MyReferral[];
  isLoading: boolean;
  error: UIError;
  refetch: () => void;
  totalReferrals: number;
  totalCommissions: number;
  referralCode: string;
  referralLink: string;
}

export const useMyReferrals = (): UseMyReferralsReturn => {
  const [referrals, setReferrals] = useState<MyReferral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<UIError>(null);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [totalCommissions, setTotalCommissions] = useState(0);
  const [referralCode, setReferralCode] = useState('');
  const [referralLink, setReferralLink] = useState('');

  const fetchMyReferrals = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const data = await getJSON('/me/referrals');
      

      // La estructura real del endpoint es data.data.referrals.users
      const responseData = data.data || data; // Fallback por si cambia la estructura
      setReferrals(responseData.referrals?.users || []);
      setTotalReferrals(responseData.referrals?.totalCount || 0);
      setTotalCommissions(responseData.commissions?.total?.amount || 0);
      setReferralCode(responseData.user?.referralCode || '');
      // Construir el enlace de referido usando el código
      const baseUrl = window.location.origin;
      setReferralLink(responseData.user?.referralCode ? `${baseUrl}/register?ref=${responseData.user?.referralCode}` : '');
    } catch (err) {
      console.error('Error fetching my referrals:', err);
      setError(err instanceof Error ? err : { message: 'Error desconocido' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReferrals();
  }, []);

  return {
    referrals,
    isLoading,
    error,
    refetch: fetchMyReferrals,
    totalReferrals,
    totalCommissions,
    referralCode,
    referralLink
  };
};