import { useState, useEffect, useCallback } from 'react';
import { withAuth } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { UIError } from '../lib/types';

interface DailyBenefit {
  day: number;
  amount: number;
  releaseDate: string;
  status: 'pending' | 'released' | 'failed';
}

interface BenefitSchedule {
  scheduleId: string;
  purchase: {
    purchaseId: string;
    totalAmount: number;
    package: {
      packageId: string;
      name: string;
    };
    confirmedAt: string;
  };
  startAt: string;
  days: number;
  dailyRate: number;
  dailyBenefitAmount: number;
  scheduleStatus: 'active' | 'completed' | 'pending';
  totalReleased: number;
  daysReleased: number;
  dailyBenefits: DailyBenefit[];
  createdAt: string;
}

interface BenefitHistory {
  id: string;
  amount: number;
  currency: string;
  description: string;
  purchaseId: string;
  dayIndex?: number;
  createdAt: string;
}

interface BenefitSummary {
  totalBenefits: number;
  totalCommissions: number;
  activeBenefitSchedules: number;
  completedBenefitSchedules: number;
}

interface BenefitsData {
  summary: BenefitSummary;
  benefitSchedules: BenefitSchedule[];
  benefitHistory: BenefitHistory[];
  commissionHistory: any[];
}

interface UseMyBenefits {
  benefits: BenefitsData | null;
  loading: boolean;
  error: UIError;
  refetch: () => Promise<void>;
}

export const useMyBenefits = (): UseMyBenefits => {
  const { token } = useAuth();
  const [benefits, setBenefits] = useState<BenefitsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<UIError>(null);

  const fetchBenefits = async () => {
    if (!token) {
      setError({ message: 'Token de acceso requerido' });
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const api = withAuth(token);
      const response = await api.GET('/me/benefits', {}) as any;
      const { data, error } = response;
      
      if (error) {
        setError({ message: error.message || 'Error al cargar beneficios' });
        return;
      }
      
      setBenefits(data);
    } catch (err: any) {
      console.error('Error fetching benefits:', err);
      setError({ 
        message: err.message || 'Error de conexión al cargar beneficios' 
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchBenefitsCallback = useCallback(fetchBenefits, [token]);

  useEffect(() => {
    if (token) {
      fetchBenefitsCallback();
    }
  }, [token, fetchBenefitsCallback]);

  return {
    benefits,
    loading,
    error,
    refetch: fetchBenefits
  };
};