import { useState, useEffect, useCallback } from 'react';
import { withAuth } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UIError } from '../lib/types';

interface Purchase {
  _id: string;
  userId: string;
  packageId: {
    _id: string;
    name: string;
    price: number;
  };
  amount: number;
  status: 'pending' | 'hash_submitted' | 'confirmed' | 'rejected';
  paymentHash?: string;
  assignedWallet?: {
    address: string;
    network: string;
  };
  createdAt: string;
  confirmedAt?: string;
  licenseStatus?: string;
  licenseId?: string;
  capPercentMax?: number;
  capReached?: boolean;
  isPaused?: boolean;
  pauseReason?: string;
  remainingDays?: number;
  progressPercent?: number;
  remainingAmount?: number;
}

interface UseMyPurchases {
  purchases: Purchase[];
  loading: boolean;
  error: UIError;
  refetch: () => Promise<void>;
  submitHash: (purchaseId: string, hash: string) => Promise<boolean>;
}

export const useMyPurchases = (): UseMyPurchases => {
  const { token } = useAuth();
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UIError>(null);

  const fetchPurchases = async () => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const api = withAuth(token);
      const response = await api.GET('/me/purchases', {}) as any;
      const { data, error } = response;
      if (error) {
        throw new Error((error as any)?.message || 'Error al cargar compras');
      }
      setPurchases((data as any)?.purchases || []);
    } catch (err: any) {
      setError(err instanceof Error ? err : { message: 'Error al cargar compras' });
      console.error('Error fetching purchases:', err);
    } finally {
      setLoading(false);
    }
  };

  const submitHash = async (purchaseId: string, hash: string): Promise<boolean> => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return false;
    }
    
    try {
      const api = withAuth(token);
      // First get all purchases to find the MongoDB _id
      const purchasesResponse = await api.GET('/me/purchases', {}) as any;
      if (purchasesResponse.error) {
        throw new Error('No se pudo obtener la información de compras');
      }
      
      const purchase = purchasesResponse?.purchases?.find(
        (p: any) => p._id === purchaseId
      );
      
      if (!purchase) {
        throw new Error('No se pudo encontrar la compra');
      }
      
      const response = await api.POST(`/me/purchases/${purchase._id}/confirm`, {
        body: {
          txHash: hash
        }
      }) as any;
      const { error } = response;
      
      if (error) {
        throw new Error((error as any)?.message || 'Error al confirmar hash de pago');
      }
      
      // Actualizar la compra localmente
      setPurchases(prev => 
        prev.map(purchase => 
          purchase._id === purchaseId 
            ? { ...purchase, paymentHash: hash, status: 'hash_submitted' as const }
            : purchase
        )
      );
      
      return true;
    } catch (err: any) {
      setError(err instanceof Error ? err : { message: 'Error al confirmar hash de pago' });
      console.error('Error submitting hash:', err);
      return false;
    }
  };

  const fetchPurchasesCallback = useCallback(fetchPurchases, [token]);

  useEffect(() => {
    if (token) {
      fetchPurchasesCallback();
    }
  }, [token, fetchPurchasesCallback]);

  return {
    purchases,
    loading,
    error,
    refetch: fetchPurchases,
    submitHash
  };
};