import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getJSON } from '../services/api';
import type {
  ReportsSalesResponse,
  ReportsReferralsResponse,
  ReportsBenefitsResponse,
  ReportsWithdrawalsResponse,
  DateRange
} from '../api/types';

// Tipos para la nueva API unificada de reportes
interface UnifiedReportsResponse {
  success: boolean;
  range: {
    start: string;
    end: string;
    tz: string;
  };
  sales: Array<{
    _id: string;
    count: number;
    totalAmount: number;
  }>;
  referrals: Array<{
    _id: string;
    total: number;
    count: number;
  }>;
  benefits: Array<{
    _id: string;
    total: number;
    count: number;
  }>;
  withdrawals: Array<{
    _id: string;
    requested: number;
    approved: number;
    paid: number;
  }>;
  overview: {
    salesCount: number;
    salesUSDT: number;
    benefitsUSDT: number;
    referralsUSDT: number;
    withdrawalsPAID: number;
  };
}

// Usando tipos del facade en lugar de interfaces locales
type SalesReport = ReportsSalesResponse;
type ReferralsReport = ReportsReferralsResponse;
type BenefitsReport = ReportsBenefitsResponse;
type WithdrawalsReport = ReportsWithdrawalsResponse;

interface UseReportsResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Hook genérico para reportes usando el cliente tipado
function useAdminReport<T>(
  endpoint: string,
  dateRange: DateRange,
  additionalParams: Record<string, string> = {}
): UseReportsResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth() as { token?: string };

  const fetchData = async () => {
    if (!token || !dateRange.from || !dateRange.to) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        from: dateRange.from,
        to: dateRange.to,
        ...additionalParams
      });

      const result = await getJSON(`/admin/reports/${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [endpoint, dateRange.from, dateRange.to, JSON.stringify(additionalParams), token]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}

// Hook para la nueva API unificada de reportes
export function useAdminReports(
  start: string, 
  end: string, 
  tz: string = 'UTC'
): UseReportsResult<UnifiedReportsResponse> {
  const [data, setData] = useState<UnifiedReportsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth() as { token?: string };

  const fetchData = async () => {
    if (!token || !start || !end) return;

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        start,
        end,
        tz
      });

      const result = await getJSON(`/admin/reports?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      setData(result);
    } catch (err: any) {
      console.error('Error fetching unified reports:', err);
      
      // Manejo específico del error NO_ROLE_ASSIGNED según las instrucciones
      if (err.response?.data?.code === 'NO_ROLE_ASSIGNED') {
        setError('Tu usuario no tiene rol admin. Contacta al administrador.');
      } else {
        setError(err.message || 'Error al cargar los reportes');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [start, end, tz, token]);

  return { data, loading, error, refetch: fetchData };
}

// Hook específico para reportes de ventas
export function useAdminReportsSales(dateRange: DateRange): UseReportsResult<SalesReport> {
  return useAdminReport<SalesReport>('sales', dateRange);
}

// Hook específico para reportes de referidos
export function useAdminReportsReferrals(dateRange: DateRange): UseReportsResult<ReferralsReport> {
  return useAdminReport<ReferralsReport>('referrals', dateRange);
}

// Hook específico para reportes de beneficios
export function useAdminReportsBenefits(dateRange: DateRange): UseReportsResult<BenefitsReport> {
  return useAdminReport<BenefitsReport>('benefits', dateRange);
}

// Hook específico para reportes de retiros
export function useAdminReportsWithdrawals(
  dateRange: DateRange,
  status?: string
): UseReportsResult<WithdrawalsReport> {
  const additionalParams = status ? { status } : {};
  return useAdminReport<WithdrawalsReport>('withdrawals', dateRange, additionalParams);
}

// Hook para exportar CSV
export function useAdminReportsExport() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { token } = useAuth();

  const exportCSV = async (
    dataset: 'sales' | 'referrals' | 'benefits' | 'withdrawals',
    dateRange: DateRange
  ) => {
    if (!token) {
      setError('Token de autorización requerido');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        dataset,
        from: dateRange.from,
        to: dateRange.to
      });

      const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/admin/reports/export.csv?${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      // Crear y descargar archivo
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${dataset}_${dateRange.from}_${dateRange.to}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al exportar CSV');
    } finally {
      setLoading(false);
    }
  };

  return {
    exportCSV,
    loading,
    error
  };
}

// Hook para obtener rangos de fecha predeterminados
export function useDefaultDateRanges() {
  const getDateRange = (days: number): DateRange => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    return {
      from: from.toISOString(),
      to: to.toISOString()
    };
  };

  return {
    last7Days: getDateRange(7),
    last30Days: getDateRange(30),
    thisMonth: {
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString(),
      to: new Date().toISOString()
    },
    lastMonth: {
      from: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toISOString(),
      to: new Date(new Date().getFullYear(), new Date().getMonth(), 0).toISOString()
    }
  };
}