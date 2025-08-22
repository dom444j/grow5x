import { useState, useEffect, useCallback } from 'react';
import { getJSON } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { withAuth } from '../lib/api';
import { UIError } from '../lib/types';

interface UserData {
  _id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  referralCode: string;
  balance: number;
  isActive: boolean;
  role: string;
  createdAt: string;
  telegramChatId?: string;
  telegramUsername?: string;
  referralStats?: {
    totalReferrals: number;
    activeReferrals: number;
    totalCommissions: number;
  };
  balances?: {
    available: number;
    pending: number;
    total: number;
  };
  settings?: {
    [key: string]: any;
  };
}

interface UseMe {
  user: UserData | null;
  loading: boolean;
  error: UIError;
  refetch: () => Promise<void>;
}

export const useMe = (): UseMe => {
  const { token } = useAuth();
  const [user, setUser] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<UIError>(null);

  const fetchMe = async () => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const api = withAuth(token);
      const response = await api.GET('/auth/me', {}) as any;
      const { data, error } = response;
      if (error) {
        throw new Error((error as any)?.message || 'Error al cargar perfil');
      }
      setUser((data as any)?.user || (data as any) || null);
    } catch (err: any) {
      setError(err instanceof Error ? err : { message: 'Error al cargar datos del usuario' });
      console.error('Error fetching user data:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMeCallback = useCallback(fetchMe, [token]);

  useEffect(() => {
    if (token) {
      fetchMeCallback();
    }
  }, [token, fetchMeCallback]);

  return {
    user,
    loading,
    error,
    refetch: fetchMe
  };
};