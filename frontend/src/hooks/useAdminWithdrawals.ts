import { useState, useEffect } from 'react';
import { api, withAuth } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UIError } from '../lib/types';

interface AdminWithdrawal {
  _id: string;
  userId: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
    balance: number;
  };
  amount: number;
  walletAddress: string;
  network: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  adminNotes?: string;
  createdAt: string;
  processedAt?: string;
  processedBy?: {
    _id: string;
    email: string;
  };
}

interface WithdrawalFilters {
  status?: string;
  userId?: string;
  network?: string;
  dateFrom?: string;
  dateTo?: string;
  minAmount?: number;
  maxAmount?: number;
  search?: string;
}

interface UseAdminWithdrawals {
  withdrawals: AdminWithdrawal[];
  loading: boolean;
  error: UIError;
  refetch: () => Promise<void>;
  approveWithdrawal: (withdrawalId: string, notes?: string) => Promise<boolean>;
  rejectWithdrawal: (withdrawalId: string, reason: string) => Promise<boolean>;
  markAsCompleted: (withdrawalId: string, txHash?: string) => Promise<boolean>;
  setFilters: (filters: WithdrawalFilters) => void;
  filters: WithdrawalFilters;
  exportData: () => Promise<boolean>;
}

export const useAdminWithdrawals = (initialFilters: WithdrawalFilters = {}): UseAdminWithdrawals => {
  const { token } = useAuth();
  const [withdrawals, setWithdrawals] = useState<AdminWithdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UIError>(null);
  const [filters, setFilters] = useState<WithdrawalFilters>(initialFilters);

  const fetchWithdrawals = async () => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
      
      const queryString = params.toString();
      const url = `/admin/withdrawals${queryString ? `?${queryString}` : ''}`;
      const authApi = withAuth(token);
      const response = await authApi.GET(url) as any;
      const { data, error } = response;
      if (error) {
        throw new Error((error as any)?.message || 'Error al cargar retiros');
      }
      // Asegurar que data sea un array
      const withdrawalsData = Array.isArray(data) ? data : [];
      setWithdrawals(withdrawalsData);
    } catch (err: any) {
      setError({ message: err instanceof Error ? err.message : 'Error al cargar retiros' });
      console.error('Error fetching admin withdrawals:', err);
    } finally {
      setLoading(false);
    }
  };

  const approveWithdrawal = async (withdrawalId: string, notes?: string): Promise<boolean> => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return false;
    }

    try {
      const authApi = withAuth(token);
      const response = await authApi.POST(`/admin/withdrawals/${withdrawalId}/approve`, {
         notes
       }) as any;
      const { error } = response;
      if (error) {
        throw new Error(error.message || 'Error al aprobar retiro');
      }
      
      // Actualizar el retiro localmente
      setWithdrawals(prev => 
        prev.map(withdrawal => 
          withdrawal._id === withdrawalId 
            ? { 
                ...withdrawal, 
                status: 'approved' as const, 
                adminNotes: notes,
                processedAt: new Date().toISOString()
              }
            : withdrawal
        )
      );
      
      return true;
    } catch (err: any) {
      setError({ message: err instanceof Error ? err.message : 'Error al aprobar retiro' });
      console.error('Error approving withdrawal:', err);
      return false;
    }
  };

  const rejectWithdrawal = async (withdrawalId: string, reason: string): Promise<boolean> => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return false;
    }

    try {
      const authApi = withAuth(token);
      const response = await authApi.POST(`/admin/withdrawals/${withdrawalId}/reject`, {
         reason, notes: reason
       }) as any;
      const { error } = response;
      if (error) {
        throw new Error(error.message || 'Error al rechazar retiro');
      }
      
      // Actualizar el retiro localmente
      setWithdrawals(prev => 
        prev.map(withdrawal => 
          withdrawal._id === withdrawalId 
            ? { 
                ...withdrawal, 
                status: 'rejected' as const, 
                adminNotes: reason,
                processedAt: new Date().toISOString()
              }
            : withdrawal
        )
      );
      
      return true;
    } catch (err: any) {
      setError({ message: err instanceof Error ? err.message : 'Error al rechazar retiro' });
      console.error('Error rejecting withdrawal:', err);
      return false;
    }
  };

  const markAsCompleted = async (withdrawalId: string, txHash?: string): Promise<boolean> => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return false;
    }

    try {
      const authApi = withAuth(token);
      const response = await authApi.POST(`/admin/withdrawals/${withdrawalId}/complete`, {
         txHash
       }) as any;
      const { error } = response;
      if (error) {
        throw new Error(error.message || 'Error al marcar como completado');
      }
      
      // Actualizar el retiro localmente
      setWithdrawals(prev => 
        prev.map(withdrawal => 
          withdrawal._id === withdrawalId 
            ? { 
                ...withdrawal, 
                status: 'completed' as const,
                processedAt: new Date().toISOString()
              }
            : withdrawal
        )
      );
      
      return true;
    } catch (err: any) {
      setError({ message: err instanceof Error ? err.message : 'Error al marcar como completado' });
      console.error('Error completing withdrawal:', err);
      return false;
    }
  };

  const exportData = async (): Promise<boolean> => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return false;
    }

    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, value.toString());
        }
      });
      
      const BASE = import.meta.env.VITE_API_URL || '';
      const response = await fetch(`${BASE}/admin/withdrawals/export?${params.toString()}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      // Crear y descargar el archivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `withdrawals_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      return true;
    } catch (err: any) {
      setError({ message: err instanceof Error ? err.message : 'Error al exportar datos' });
      console.error('Error exporting withdrawals:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [filters, token]);

  return {
    withdrawals,
    loading,
    error,
    refetch: fetchWithdrawals,
    approveWithdrawal,
    rejectWithdrawal,
    markAsCompleted,
    setFilters,
    filters,
    exportData
  };
};