import { useState, useEffect, useCallback } from 'react';
import { getJSON } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { UIError } from '../lib/types';

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

export const useUserOverview = () => {
  const { token } = useAuth();
  const [overview, setOverview] = useState<UserOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<UIError | null>(null);

  const fetchOverview = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      const response = await getJSON('/api/me/overview') as {success: boolean, data: UserOverview};
      setOverview(response.data);
    } catch (err: any) {
      console.error('Error fetching user overview:', err);
      setError({
        message: err.response?.data?.message || 'Error al cargar el resumen'
      });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  const refetch = useCallback(() => {
    fetchOverview();
  }, [fetchOverview]);

  return {
    overview,
    isLoading,
    error,
    refetch
  };
};

export { useUserOverview as default };