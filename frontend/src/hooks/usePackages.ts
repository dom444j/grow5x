// src/hooks/usePackages.ts
import { useState, useEffect } from 'react';
import { getJSON } from '@/lib/api';
import { ApiResponse, isOk, PackagesResponse, UIError } from '@/lib/types';
import { useAuth } from '../contexts/AuthContext';

interface UsePackages {
  packages: any[];
  loading: boolean;
  error: UIError;
  refetch: () => Promise<void>;
}

export async function fetchPackages() {
  const res = await getJSON<ApiResponse<PackagesResponse>>('/public/packages');
  if (isOk(res)) return res.data.items;
  throw new Error(res.message);
}

export const usePackages = (): UsePackages => {
  const { token } = useAuth();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UIError>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const packagesData = await fetchPackages();
      setPackages(packagesData || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error inesperado';
      setError({ message: msg });
      console.error('Error fetching packages:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  return {
    packages,
    loading,
    error,
    refetch: fetchData
  };
};