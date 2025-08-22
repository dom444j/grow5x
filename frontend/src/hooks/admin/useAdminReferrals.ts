import { useState, useEffect } from 'react';
import { getJSON } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

interface ReferralUser {
  _id: string;
  name: string;
  email: string;
  referralCode: string;
  referredBy?: {
    _id: string;
    name: string;
    email: string;
  };
  referredUsers: {
    _id: string;
    name: string;
    email: string;
    createdAt: string;
  }[];
  totalReferrals: number;
  totalCommissions: number;
  createdAt: string;
  isActive: boolean;
}

interface UseAdminReferralsReturn {
  referrals: ReferralUser[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  totalUsers: number;
  totalReferrals: number;
  totalCommissions: number;
}

export const useAdminReferrals = (): UseAdminReferralsReturn => {
  const [referrals, setReferrals] = useState<ReferralUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalUsers, setTotalUsers] = useState(0);
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [totalCommissions, setTotalCommissions] = useState(0);
  const { session } = useAuth();

  const fetchReferrals = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      if (!session?.token) {
        throw new Error('No hay token de autenticación');
      }
      
      const data = await getJSON('/admin/referrals', { token: session.token });
      
      if (data.success) {
        setReferrals(data.data?.users || []);
        setTotalUsers(data.data?.totalUsers || 0);
        setTotalReferrals(data.data?.totalReferrals || 0);
        setTotalCommissions(data.data?.totalCommissions || 0);
      } else {
        throw new Error(data.message || 'Error al obtener los referidos');
      }
    } catch (err) {
      console.error('Error fetching admin referrals:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  return {
    referrals,
    isLoading,
    error,
    refetch: fetchReferrals,
    totalUsers,
    totalReferrals,
    totalCommissions
  };
};