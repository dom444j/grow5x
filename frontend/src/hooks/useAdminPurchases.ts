import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { getJSON, postJSON } from '../services/api';
import { UIError } from '../lib/types';

interface AdminPurchase {
  _id: string;
  userId: {
    _id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
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
  // Información de licencia generada
  licenseId?: string;
  licenseStatus?: 'ACTIVE' | 'PAUSED' | 'COMPLETED';
}

interface PurchaseFilters {
  status?: string;
  userId?: string;
  packageId?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface UseAdminPurchases {
  purchases: AdminPurchase[];
  loading: boolean;
  error: UIError;
  refetch: () => Promise<void>;
  confirmPayment: (purchaseId: string) => Promise<boolean>;
  rejectPayment: (purchaseId: string, reason?: string) => Promise<boolean>;
  setFilters: (filters: PurchaseFilters) => void;
  filters: PurchaseFilters;
}

export const useAdminPurchases = (initialFilters: PurchaseFilters = {}): UseAdminPurchases => {
  const [purchases, setPurchases] = useState<AdminPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UIError>(null);
  const [filters, setFilters] = useState<PurchaseFilters>(initialFilters);


  const fetchPurchases = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await getJSON('/admin/payments/pending');
      
      // Manejar diferentes estructuras de respuesta
      let purchasesData: AdminPurchase[] = [];
      if (response) {
        if (Array.isArray(response)) {
          purchasesData = response as AdminPurchase[];
        } else if (response && Array.isArray(response)) {
        purchasesData = response as AdminPurchase[];
        } else if (response.purchases && Array.isArray(response.purchases)) {
          purchasesData = response.purchases as AdminPurchase[];
        }
      }
      
      setPurchases(purchasesData);
    } catch (err: any) {
      setError({ message: err instanceof Error ? err.message : 'Error al cargar compras' });
      console.error('Error fetching admin purchases:', err);
      setPurchases([]); // Asegurar que purchases sea siempre un array
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (purchaseId: string): Promise<boolean> => {
    try {
      await postJSON('/admin/payments/confirm', { purchaseId });
      
      // Actualizar la compra localmente
      setPurchases(prev => 
        prev.map(purchase => 
          purchase._id === purchaseId 
            ? { ...purchase, status: 'confirmed' as const, confirmedAt: new Date().toISOString() }
            : purchase
        )
      );
      
      return true;
    } catch (err: any) {
      setError({ message: err instanceof Error ? err.message : 'Error al confirmar pago' });
      console.error('Error confirming payment:', err);
      return false;
    }
  };

  const rejectPayment = async (purchaseId: string, reason?: string): Promise<boolean> => {
    try {
      await postJSON('/admin/payments/reject', { purchaseId, reason });
      
      // Actualizar la compra localmente
      setPurchases(prev => 
        prev.map(purchase => 
          purchase._id === purchaseId 
            ? { ...purchase, status: 'rejected' as const }
            : purchase
        )
      );
      
      return true;
    } catch (err: any) {
      setError({ message: err instanceof Error ? err.message : 'Error al rechazar pago' });
      console.error('Error rejecting payment:', err);
      return false;
    }
  };

  useEffect(() => {
    fetchPurchases();
  }, [filters]);

  return {
    purchases,
    loading,
    error,
    refetch: fetchPurchases,
    confirmPayment,
    rejectPayment,
    setFilters,
    filters
  };
};