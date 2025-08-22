import { useState, useEffect, useCallback } from 'react';
import { getJSON, postJSON } from "../services/api";
import { useAuth } from '../contexts/AuthContext';
import { useWithdrawalRateLimit } from './useRateLimit';
import { UIError } from '../lib/types';

export type Withdrawal = {
  id: string;
  userId: string;
  amountUSDT: number;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PAID";
  network: "BEP20";
  toAddress: string;
  txHash?: string | null;
  eta?: string | null;
  createdAt: string;
  updatedAt: string;
}

export type MyWithdrawalsResponse = {
  items: Withdrawal[];
  total: number;
  summary: {
    availableUSDT: number;
    pendingUSDT: number;
    minWithdrawalUSDT: number;
    sla: string;
  }
}

interface WithdrawalRequest {
  amountUSDT: number;
  toAddress: string;
  network?: string;
}

export async function fetchMyWithdrawals(params?: Record<string, string | number>) {
  const qs = params ? new URLSearchParams(params as Record<string, string>).toString() : '';
  return await getJSON(`/me/withdrawals${qs ? `?${qs}` : ""}`) as MyWithdrawalsResponse;
}

export async function requestWithdrawal(payload: { amountUSDT: number; toAddress: string }) {
  return await postJSON(`/me/withdrawals`, { ...payload, network: "BEP20" });
}

interface UseMyWithdrawals {
  data: MyWithdrawalsResponse | null;
  loading: boolean;
  submitting: boolean;
  error: UIError | null;
  refetch: () => Promise<void>;
  requestWithdrawal: (request: WithdrawalRequest) => Promise<void>;
}

export const useMyWithdrawals = (): UseMyWithdrawals => {
  const { token } = useAuth();
  const [data, setData] = useState<MyWithdrawalsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<UIError | null>(null);
  
  // Rate limiting hook
  const withdrawalRateLimit = useWithdrawalRateLimit();

  const fetchWithdrawals = async () => {
    if (!token) {
      setError({ message: 'No hay token de autenticación' });
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      const response = await fetchMyWithdrawals();
      setData(response);
    } catch (err: any) {
      console.error('Error fetching withdrawals:', err);
      setError({ 
        message: err.response?.data?.message || err.message || 'Error de conexión' 
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRequestWithdrawal = async (withdrawalData: WithdrawalRequest): Promise<void> => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return;
    }

    // Check rate limiting
    if (!withdrawalRateLimit.canProceed) {
      setError({ message: withdrawalRateLimit.getBlockedMessage() });
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      await requestWithdrawal({
        amountUSDT: withdrawalData.amountUSDT,
        toAddress: withdrawalData.toAddress
      });
      
      // Refresh withdrawals list after successful request
      await fetchWithdrawals();
    } catch (err: any) {
      setError({ 
        message: err.response?.data?.message || err.message || 'Error al solicitar retiro' 
      });
      console.error('Error requesting withdrawal:', err);
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const fetchWithdrawalsCallback = useCallback(fetchWithdrawals, [token]);

  useEffect(() => {
    if (token) {
      fetchWithdrawalsCallback();
    }
  }, [token, fetchWithdrawalsCallback]);

  const refetch = useCallback(() => fetchWithdrawals(), [fetchWithdrawals]);

  return {
    data,
    loading,
    submitting,
    error,
    refetch,
    requestWithdrawal: handleRequestWithdrawal,
  };
};