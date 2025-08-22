// src/hooks/usePayments.ts
import { useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { postJSON, getJSON } from '@/lib/api';
import { ApiResponse, isOk, UIError } from '@/lib/types';
import { validateTxHash, validateBEP20Address, validatePaymentForm, sanitizeInput } from '../utils/validation';
import { usePaymentRateLimit, useHashConfirmationRateLimit } from './useRateLimit';
import { useAuth } from '../contexts/AuthContext';

interface PaymentSubmission {
  packageId: string;
  amount: number;
}

interface PaymentResponse {
  purchaseId: string;
  assignedWallet: {
    address: string;
    network: string;
  };
  amount: number;
  status: string;
}

interface ConfirmHashData {
  purchaseId: string;
  txHash: string;
}

interface UsePayments {
  loading: boolean;
  isSubmitting: boolean;
  isConfirming: boolean;
  error: UIError;
  submitPayment: (data: PaymentSubmission) => Promise<PaymentResponse | null>;
  confirmHash: (data: ConfirmHashData) => Promise<boolean>;
  validateTxHash: (txHash: string) => boolean;
  validateBEP20Address: (address: string) => boolean;
  clearError: () => void;
  paymentRateLimit: {
    canProceed: boolean;
    isBlocked: boolean;
    remainingAttempts: number;
    timeUntilReset: number;
    getBlockedMessage: () => string;
  };
  hashRateLimit: {
    canProceed: boolean;
    isBlocked: boolean;
    remainingAttempts: number;
    timeUntilReset: number;
    getBlockedMessage: () => string;
  };
}

export const usePayments = (): UsePayments => {
  const { token } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [error, setError] = useState<UIError>(null);
  
  // Rate limiting hooks
  const paymentRateLimit = usePaymentRateLimit();
  const hashRateLimit = useHashConfirmationRateLimit();

  const submitPayment = useCallback(async (data: PaymentSubmission): Promise<PaymentResponse | null> => {
    if (!token) {
      const msg = 'Token de autenticación requerido';
      setError({ message: msg });
      toast.error(msg);
      return null;
    }

    // Check rate limit before proceeding
    if (!paymentRateLimit.canProceed) {
      const message = paymentRateLimit.getBlockedMessage();
      setError({ message });
      toast.error(message);
      return null;
    }
    
    // Attempt rate limit check
    if (!paymentRateLimit.attempt()) {
      const message = paymentRateLimit.getBlockedMessage();
      setError({ message });
      toast.error(message);
      return null;
    }
    
    try {
      setIsSubmitting(true);
      setError(null);
      
      // Validate form data
      const validation = validatePaymentForm({
        packageId: data.packageId,
        amount: data.amount
      });
      
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        throw new Error(firstError);
      }
      
      // Sanitize input data
      const sanitizedData = {
        ...data,
        packageId: sanitizeInput(data.packageId)
      };
      
      const res = await postJSON<ApiResponse<PaymentResponse>>('/me/purchases', {
        packageId: sanitizedData.packageId,
        amountUSDT: sanitizedData.amount
      }, { token });
      
      if (isOk(res)) {
        toast.success('Pago iniciado correctamente');
        return res.data;
      } else {
        throw new Error((res as any)?.message || 'Error en el pago');
      }
    } catch (err: any) {
      const msg = err.message || 'Error al procesar el pago';
      setError({ message: msg });
      toast.error(msg);
      console.error('Error submitting payment:', err);
      return null;
    } finally {
      setIsSubmitting(false);
    }
  }, [paymentRateLimit, token]);

  const confirmHash = useCallback(async (data: ConfirmHashData): Promise<boolean> => {
    if (!token) {
      const msg = 'Token de autenticación requerido';
      setError({ message: msg });
      toast.error(msg);
      return false;
    }

    // Check rate limit before proceeding
    if (!hashRateLimit.canProceed) {
      const message = hashRateLimit.getBlockedMessage();
      setError({ message });
      toast.error(message);
      return false;
    }
    
    // Attempt rate limit check
    if (!hashRateLimit.attempt()) {
      const message = hashRateLimit.getBlockedMessage();
      setError({ message });
      toast.error(message);
      return false;
    }
    
    try {
      setIsConfirming(true);
      setError(null);

      // Validate transaction hash
      if (!validateTxHash(data.txHash)) {
        throw new Error('Hash de transacción inválido (debe tener 64 caracteres hexadecimales)');
      }
      
      // Validate form data
      const validation = validatePaymentForm({
        txHash: data.txHash,
        purchaseId: data.purchaseId
      });
      
      if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0];
        throw new Error(firstError);
      }
      
      // Sanitize input data
      const sanitizedData = {
        purchaseId: sanitizeInput(data.purchaseId),
        txHash: sanitizeInput(data.txHash.toLowerCase()) // Normalize to lowercase
      };
      
      // First, get the purchase by purchaseId to find the MongoDB _id
      const purchasesRes = await getJSON<ApiResponse<any>>('/me/purchases', { token });
      if (!isOk(purchasesRes)) {
        throw new Error('No se pudo obtener la información de la compra');
      }
      
      const purchase = purchasesRes.data.purchases?.find(
        (p: any) => p.purchaseId === sanitizedData.purchaseId
      );
      
      if (!purchase) {
        throw new Error('No se pudo encontrar la compra');
      }
      
      const res = await postJSON<ApiResponse<any>>(`/me/purchases/${purchase._id}/confirm`, {
        txHash: sanitizedData.txHash
      }, { token });
      
      if (isOk(res)) {
        toast.success('Hash de transacción confirmado correctamente');
        return true;
      } else {
        throw new Error(res.message);
      }
    } catch (err: any) {
      const msg = err.message || 'Error al confirmar el hash';
      setError({ message: msg });
      toast.error(msg);
      console.error('Error confirming hash:', err);
      return false;
    } finally {
      setIsConfirming(false);
    }
  }, [hashRateLimit, token]);

  // Validation functions are now imported from utils/validation

  const clearError = () => {
    setError(null);
  };

  return {
    loading: isSubmitting || isConfirming,
    isSubmitting,
    isConfirming,
    error,
    submitPayment,
    confirmHash,
    validateTxHash,
    validateBEP20Address,
    clearError,
    // Rate limit information
    paymentRateLimit: {
      canProceed: paymentRateLimit.canProceed,
      isBlocked: paymentRateLimit.isBlocked,
      remainingAttempts: paymentRateLimit.remainingAttempts,
      timeUntilReset: paymentRateLimit.timeUntilReset,
      getBlockedMessage: paymentRateLimit.getBlockedMessage
    },
    hashRateLimit: {
      canProceed: hashRateLimit.canProceed,
      isBlocked: hashRateLimit.isBlocked,
      remainingAttempts: hashRateLimit.remainingAttempts,
      timeUntilReset: hashRateLimit.timeUntilReset,
      getBlockedMessage: hashRateLimit.getBlockedMessage
    }
  };
};