import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import {
  WithdrawalsListResponse,
  CreateWithdrawalRequest,
  CreateWithdrawalResponse,
  WithdrawalItem
} from '../api/types';
import { getJSON, postJSON } from '../api/client';
import { UIError } from '../lib/types';

// Hook para gestionar la lista de retiros
export const useWithdrawalsList = () => {
  const [data, setData] = useState<WithdrawalItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<UIError>(null);
  const [total, setTotal] = useState(0);

  const fetchWithdrawals = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await getJSON<WithdrawalsListResponse>('/me/withdrawals');
      setData(response.items);
      setTotal(response.total);
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cargar los retiros';
      setError({ message: errorMessage });
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    fetchWithdrawals();
  }, [fetchWithdrawals]);

  return {
    data,
    isLoading,
    error,
    total,
    fetchWithdrawals,
    refetch
  };
};

// Hook para solicitar OTP
export const useRequestOtp = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<UIError>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const requestOtp = useCallback(async () => {
    if (cooldownSeconds > 0) {
      toast.error('Espera antes de solicitar otro código OTP');
      return false;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      await postJSON('/me/otp/request', {});
      toast.success('Código OTP enviado correctamente');
      
      // Iniciar cooldown de 60 segundos
      setCooldownSeconds(60);
      const interval = setInterval(() => {
        setCooldownSeconds(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return true;
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al solicitar código OTP';
      setError({ message: errorMessage });
      
      if (err.status === 429) {
        toast.error('Demasiadas solicitudes. Espera unos segundos.');
      } else {
        toast.error(errorMessage);
      }
      
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [cooldownSeconds]);

  return {
    isLoading,
    error,
    cooldownSeconds,
    requestOtp
  };
};

// Hook para crear retiros
export const useCreateWithdrawal = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<UIError>(null);

  const createWithdrawal = useCallback(async (request: CreateWithdrawalRequest) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await postJSON<CreateWithdrawalResponse>('/me/withdrawals', request);
      toast.success('Solicitud de retiro creada exitosamente');
      return response;
    } catch (err: any) {
      const errorMessage = err instanceof Error ? err.message : 'Error al crear la solicitud de retiro';
      setError({ message: errorMessage });
      
      if (err.status === 401) {
        toast.error('Sesión expirada. Por favor, inicia sesión nuevamente.');
      } else if (err.status === 429) {
        toast.error('Demasiadas solicitudes. Espera unos segundos.');
      } else if (err.status === 400) {
        toast.error('Datos inválidos. Verifica la información ingresada.');
      } else {
        toast.error(errorMessage);
      }
      
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isLoading,
    error,
    createWithdrawal
  };
};

// Hook combinado para facilitar el uso
export const useWithdrawals = () => {
  const withdrawalsList = useWithdrawalsList();
  const requestOtp = useRequestOtp();
  const createWithdrawal = useCreateWithdrawal();

  return {
    ...withdrawalsList,
    ...requestOtp,
    ...createWithdrawal
  };
};