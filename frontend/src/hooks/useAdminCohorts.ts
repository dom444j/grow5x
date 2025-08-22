import { useState, useEffect, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { getJSON, postJSON } from '../services/api';

export interface Cohort {
  _id: string;
  batchId: string;
  name: string;
  description?: string;
  featureFlags: {
    FEATURE_COHORT_PACKAGES: boolean;
    FEATURE_COHORT_WITHDRAWALS: boolean;
  };
  referralConfig: {
    directLevel1Percentage: number;
    specialParentCodePercentage: number;
    specialParentCodeDelayDays: number;
  };
  isActive: boolean;
  createdBy: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  updatedBy?: {
    _id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CohortFilters {
  search: string;
  isActive?: boolean;
}

export interface CreateCohortData {
  batchId: string;
  name: string;
  description?: string;
  featureFlags?: {
    FEATURE_COHORT_PACKAGES?: boolean;
    FEATURE_COHORT_WITHDRAWALS?: boolean;
  };
  referralConfig?: {
    directLevel1Percentage?: number;
    specialParentCodePercentage?: number;
    specialParentCodeDelayDays?: number;
  };
}

export interface UpdateCohortData {
  name?: string;
  description?: string;
  featureFlags?: {
    FEATURE_COHORT_PACKAGES?: boolean;
    FEATURE_COHORT_WITHDRAWALS?: boolean;
  };
  referralConfig?: {
    directLevel1Percentage?: number;
    specialParentCodePercentage?: number;
    specialParentCodeDelayDays?: number;
  };
  isActive?: boolean;
}

interface PaginationData {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export const useAdminCohorts = () => {
  const [cohorts, setCohorts] = useState<Cohort[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [filters, setFilters] = useState<CohortFilters>({
    search: '',
    isActive: undefined
  });
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 20,
    total: 0,
    pages: 0
  });

  // Obtener cohortes
  const fetchCohorts = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString()
      });

      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.isActive !== undefined) {
        params.append('isActive', filters.isActive.toString());
      }

      const queryString = params.toString();
      const url = `/admin/cohorts${queryString ? `?${queryString}` : ''}`;
      const response = await getJSON(url);
      
      if (response?.success) {
        setCohorts(response.data || []);
      setPagination(response.pagination);
      }
    } catch (error: any) {
      console.error('Error fetching cohorts:', error);
      toast.error(error.response?.data?.error || 'Error al cargar cohortes');
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, filters]);

  // Crear cohorte
  const createCohort = async (data: CreateCohortData): Promise<boolean> => {
    try {
      setActionLoading(true);
      const response = await postJSON('/admin/cohorts', data);
      
      if (response.success) {
        toast.success('Cohorte creada exitosamente');
        await fetchCohorts();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error creating cohort:', error);
      toast.error(error.response?.data?.error || 'Error al crear cohorte');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Actualizar cohorte
  const updateCohort = async (batchId: string, data: UpdateCohortData): Promise<boolean> => {
    try {
      setActionLoading(true);
      const response = await postJSON(`/admin/cohorts/${batchId}`, data);
      
      if (response.success) {
        toast.success('Cohorte actualizada exitosamente');
        await fetchCohorts();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error updating cohort:', error);
      toast.error(error.response?.data?.error || 'Error al actualizar cohorte');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Obtener cohorte específica
  const getCohort = async (batchId: string): Promise<Cohort | null> => {
    try {
      const response = await getJSON(`/admin/cohorts/${batchId}`);
      
      if (response?.success) {
        return response;
      }
      return null;
    } catch (error: any) {
      console.error('Error fetching cohort:', error);
      toast.error(error.response?.data?.error || 'Error al cargar cohorte');
      return null;
    }
  };

  // Eliminar cohorte (desactivar)
  const deleteCohort = async (batchId: string): Promise<boolean> => {
    try {
      setActionLoading(true);
      const response = await postJSON(`/admin/cohorts/${batchId}`, { isActive: false });
      
      if (response.success) {
        toast.success('Cohorte desactivada exitosamente');
        await fetchCohorts();
        return true;
      }
      return false;
    } catch (error: any) {
      console.error('Error deleting cohort:', error);
      toast.error(error.response?.data?.error || 'Error al desactivar cohorte');
      return false;
    } finally {
      setActionLoading(false);
    }
  };

  // Cambiar página
  const changePage = (page: number) => {
    setPagination(prev => ({ ...prev, page }));
  };

  // Cambiar filtros
  const updateFilters = (newFilters: Partial<CohortFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilters({ search: '', isActive: undefined });
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // Cargar datos iniciales
  useEffect(() => {
    fetchCohorts();
  }, [fetchCohorts]);

  return {
    // Data
    cohorts,
    loading,
    actionLoading,
    filters,
    pagination,
    
    // Actions
    fetchCohorts,
    createCohort,
    updateCohort,
    getCohort,
    deleteCohort,
    changePage,
    updateFilters,
    clearFilters
  };
};